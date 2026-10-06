-- Additive Cramble-only separation. The original snapshots and their complete
-- revision history remain intact for compatibility, offline clients and recovery.
CREATE TABLE IF NOT EXISTS cramble_habit_state (
  profile_id text PRIMARY KEY CHECK (profile_id = 'cramble'),
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  source_revision integer NOT NULL,
  synced_at timestamptz NOT NULL
);
-- migrate:split

CREATE TABLE IF NOT EXISTS cramble_observatory_state (
  profile_id text PRIMARY KEY CHECK (profile_id = 'cramble'),
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  source_revision integer NOT NULL,
  synced_at timestamptz NOT NULL
);
-- migrate:split

CREATE TABLE IF NOT EXISTS cramble_domain_history (
  domain text NOT NULL CHECK (domain IN ('habits', 'observatory')),
  profile_id text NOT NULL CHECK (profile_id = 'cramble'),
  revision integer NOT NULL,
  source_revision integer NOT NULL,
  state jsonb NOT NULL,
  synced_at timestamptz NOT NULL,
  PRIMARY KEY (domain, profile_id, revision)
);

-- migrate:split

CREATE OR REPLACE FUNCTION cramble_domain_slice(document jsonb, domain text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  activity_ids text[];
  result jsonb;
  field text;
  selected jsonb;
  habits boolean := domain = 'habits';
BEGIN
  IF domain NOT IN ('habits', 'observatory') THEN RAISE EXCEPTION 'Unknown Cramble domain'; END IF;
  SELECT coalesce(array_agg(DISTINCT id), ARRAY[]::text[]) INTO activity_ids
  FROM (
    SELECT item->>'id' AS id FROM jsonb_array_elements(coalesce(document->'openActivities', '[]'::jsonb)) item
    UNION
    SELECT log_ids.id FROM jsonb_each(coalesce(document->'openActivityLogs', '{}'::jsonb)) days,
      LATERAL jsonb_object_keys(days.value) AS log_ids(id)
  ) ids;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO result
  FROM jsonb_each(document) WHERE key = ANY(CASE WHEN habits THEN
    ARRAY['openActivities','openActivityLogs','rhythm'] ELSE
    ARRAY['customHabits','questActivations','activeDailyQuests','activeLongTermQuestIds',
      'dailyCompletions','habitOccurrences','longTermWindows','longTermCompletions',
      'questSkips','eveningWeeds','totalFlowers'] END);
  -- Ownership is based on immutable IDs, never on the display name.
  IF document ? 'habitSettings' THEN
    SELECT coalesce(jsonb_object_agg(key,value), '{}'::jsonb) INTO selected
    FROM jsonb_each(document->'habitSettings')
    WHERE (key = ANY(activity_ids) OR key LIKE 'open-%') = habits;
    result := result || jsonb_build_object('habitSettings', selected);
  END IF;
  FOREACH field IN ARRAY ARRAY['deletedHabitIds','backfillAudit'] LOOP
    IF document ? field THEN
      SELECT coalesce(jsonb_agg(value ORDER BY ordinal), '[]'::jsonb) INTO selected
      FROM jsonb_array_elements(document->field) WITH ORDINALITY entries(value,ordinal)
      WHERE (CASE WHEN field='deletedHabitIds' THEN value #>> '{}' ELSE value->>'habitId' END = ANY(activity_ids)
        OR CASE WHEN field='deletedHabitIds' THEN value #>> '{}' ELSE value->>'habitId' END LIKE 'open-%') = habits;
      result := result || jsonb_build_object(field, selected);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- migrate:split

CREATE OR REPLACE FUNCTION sync_cramble_domains()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.profile_id <> 'cramble' THEN RETURN NEW; END IF;
  INSERT INTO cramble_habit_state AS target(profile_id,state,source_revision,synced_at)
  VALUES (NEW.profile_id,cramble_domain_slice(NEW.state,'habits'),NEW.revision,NEW.synced_at)
  ON CONFLICT(profile_id) DO UPDATE SET state=EXCLUDED.state,
    revision=target.revision + CASE WHEN target.state IS DISTINCT FROM EXCLUDED.state THEN 1 ELSE 0 END,
    source_revision=EXCLUDED.source_revision,
    synced_at=CASE WHEN target.state IS DISTINCT FROM EXCLUDED.state THEN EXCLUDED.synced_at ELSE target.synced_at END;
  INSERT INTO cramble_observatory_state AS target(profile_id,state,source_revision,synced_at)
  VALUES (NEW.profile_id,cramble_domain_slice(NEW.state,'observatory'),NEW.revision,NEW.synced_at)
  ON CONFLICT(profile_id) DO UPDATE SET state=EXCLUDED.state,
    revision=target.revision + CASE WHEN target.state IS DISTINCT FROM EXCLUDED.state THEN 1 ELSE 0 END,
    source_revision=EXCLUDED.source_revision,
    synced_at=CASE WHEN target.state IS DISTINCT FROM EXCLUDED.state THEN EXCLUDED.synced_at ELSE target.synced_at END;
  INSERT INTO cramble_domain_history(domain,profile_id,revision,source_revision,state,synced_at)
    SELECT 'habits',profile_id,revision,source_revision,state,synced_at FROM cramble_habit_state WHERE profile_id=NEW.profile_id
    UNION ALL
    SELECT 'observatory',profile_id,revision,source_revision,state,synced_at FROM cramble_observatory_state WHERE profile_id=NEW.profile_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- The trigger also covers older deployed clients during a rolling deployment.
-- All copies are in the same transaction as the existing revision-checked save.
-- migrate:split

CREATE OR REPLACE TRIGGER cramble_domain_sync
AFTER INSERT OR UPDATE OF state, revision ON hana_state_snapshots
FOR EACH ROW EXECUTE FUNCTION sync_cramble_domains();

-- migrate:split

INSERT INTO cramble_habit_state(profile_id,state,source_revision,synced_at)
SELECT profile_id,cramble_domain_slice(state,'habits'),revision,synced_at
FROM hana_state_snapshots WHERE profile_id='cramble'
ON CONFLICT DO NOTHING;
-- migrate:split

INSERT INTO cramble_observatory_state(profile_id,state,source_revision,synced_at)
SELECT profile_id,cramble_domain_slice(state,'observatory'),revision,synced_at
FROM hana_state_snapshots WHERE profile_id='cramble'
ON CONFLICT DO NOTHING;
-- migrate:split

INSERT INTO cramble_domain_history(domain,profile_id,revision,source_revision,state,synced_at)
SELECT 'habits',profile_id,revision,source_revision,state,synced_at FROM cramble_habit_state
UNION ALL
SELECT 'observatory',profile_id,revision,source_revision,state,synced_at FROM cramble_observatory_state
ON CONFLICT DO NOTHING;

-- Common profile metadata (dates, emotions, Someday, profile-wide pause, sync
-- tokens and the compatibility lifecycle index) remains in the profile snapshot.
-- migrate:split

CREATE OR REPLACE VIEW cramble_composed_state AS
SELECT s.profile_id, s.current_date_key, s.total_flowers, s.revision, s.synced_at,
  CASE WHEN h.source_revision=s.revision AND o.source_revision=s.revision THEN
    s.state || (h.state - ARRAY['habitSettings','deletedHabitIds','backfillAudit'])
      || (o.state - ARRAY['habitSettings','deletedHabitIds','backfillAudit'])
    ELSE s.state END AS state
FROM hana_state_snapshots s
LEFT JOIN cramble_habit_state h ON h.profile_id=s.profile_id
LEFT JOIN cramble_observatory_state o ON o.profile_id=s.profile_id
WHERE s.profile_id='cramble';
