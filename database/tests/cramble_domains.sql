-- Run after 002_cramble_domains.sql in a transaction and ROLLBACK the transaction.
-- Mutations below target a temporary snapshot, never a production profile row.
CREATE TEMP TABLE cramble_domain_test_snapshot (LIKE hana_state_snapshots INCLUDING DEFAULTS) ON COMMIT DROP;
-- migrate:split
CREATE TRIGGER cramble_domain_test_sync AFTER UPDATE ON cramble_domain_test_snapshot
FOR EACH ROW EXECUTE FUNCTION sync_cramble_domains();
-- migrate:split
INSERT INTO cramble_domain_test_snapshot SELECT * FROM hana_state_snapshots WHERE profile_id='cramble';
-- migrate:split
DO $$
DECLARE
  habits_revision integer;
  lessons_revision integer;
  original_fingerprint text;
  original_history bigint;
BEGIN
  SELECT md5(state::text) INTO original_fingerprint FROM hana_state_snapshots WHERE profile_id='cramble';
  SELECT count(*) INTO original_history FROM hana_state_snapshot_history;
  IF EXISTS (SELECT 1 FROM hana_state_snapshots s JOIN cramble_composed_state c USING(profile_id) WHERE s.state <> c.state)
    THEN RAISE EXCEPTION 'Recomposition changed existing data'; END IF;
  SELECT revision INTO habits_revision FROM cramble_habit_state WHERE profile_id='cramble';
  SELECT revision INTO lessons_revision FROM cramble_observatory_state WHERE profile_id='cramble';
  UPDATE cramble_domain_test_snapshot SET state=jsonb_set(state, '{openActivityLogs}',
    coalesce(state->'openActivityLogs','{}'::jsonb) || '{"2000-01-01":{"open-cramble-storage-test":1}}'::jsonb), revision=revision+1;
  IF (SELECT revision FROM cramble_habit_state WHERE profile_id='cramble') <> habits_revision+1
    OR (SELECT revision FROM cramble_observatory_state WHERE profile_id='cramble') <> lessons_revision
    THEN RAISE EXCEPTION 'A habit change affected the wrong domain'; END IF;
  UPDATE cramble_domain_test_snapshot SET state=jsonb_set(state, '{totalFlowers}', to_jsonb((state->>'totalFlowers')::integer+1)), revision=revision+1;
  IF (SELECT revision FROM cramble_habit_state WHERE profile_id='cramble') <> habits_revision+1
    OR (SELECT revision FROM cramble_observatory_state WHERE profile_id='cramble') <> lessons_revision+1
    THEN RAISE EXCEPTION 'A lesson change affected the wrong domain'; END IF;
  UPDATE cramble_domain_test_snapshot SET state=jsonb_set(state, '{dailyEmotions}', '{"2000-01-01":"bright"}'::jsonb), revision=revision+1;
  IF (SELECT revision FROM cramble_habit_state WHERE profile_id='cramble') <> habits_revision+1
    OR (SELECT revision FROM cramble_observatory_state WHERE profile_id='cramble') <> lessons_revision+1
    THEN RAISE EXCEPTION 'An emotion changed habit or lesson storage'; END IF;
  IF original_fingerprint <> (SELECT md5(state::text) FROM hana_state_snapshots WHERE profile_id='cramble')
    OR original_history <> (SELECT count(*) FROM hana_state_snapshot_history)
    THEN RAISE EXCEPTION 'A test changed a production record'; END IF;
END;
$$;
