CREATE TABLE IF NOT EXISTS hana_state_snapshots (
  profile_id text PRIMARY KEY,
  current_date_key text NOT NULL,
  total_flowers integer NOT NULL,
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  write_token text NOT NULL DEFAULT 'legacy',
  synced_at timestamptz NOT NULL
);

-- migrate:split

CREATE TABLE IF NOT EXISTS hana_quest_statuses (
  profile_id text NOT NULL,
  quest_group text NOT NULL CHECK (quest_group IN ('daily', 'longTerm')),
  quest_id text NOT NULL,
  period_key text NOT NULL,
  date_key text,
  window_start text,
  due_date text,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'skipped', 'paused')),
  flowers_earned integer NOT NULL DEFAULT 0,
  history_epoch text NOT NULL DEFAULT 'legacy',
  synced_at timestamptz NOT NULL,
  PRIMARY KEY (profile_id, quest_group, quest_id, period_key)
);

-- migrate:split

ALTER TABLE hana_quest_statuses
  ADD COLUMN IF NOT EXISTS history_epoch text NOT NULL DEFAULT 'legacy';

-- migrate:split

CREATE TABLE IF NOT EXISTS hana_state_snapshot_history (
  profile_id text NOT NULL,
  revision integer NOT NULL,
  current_date_key text NOT NULL,
  total_flowers integer NOT NULL,
  state jsonb NOT NULL,
  write_token text NOT NULL,
  synced_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, revision)
);

-- migrate:split

ALTER TABLE hana_state_snapshots
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

-- migrate:split

ALTER TABLE hana_state_snapshots
  ADD COLUMN IF NOT EXISTS write_token text NOT NULL DEFAULT 'legacy';

-- migrate:split

CREATE TABLE IF NOT EXISTS hana_weed_statuses (
  profile_id text NOT NULL,
  date_key text NOT NULL,
  weed_id text NOT NULL,
  checked boolean NOT NULL,
  synced_at timestamptz NOT NULL,
  PRIMARY KEY (profile_id, date_key, weed_id)
);

-- migrate:split

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hana_quest_statuses_status_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%paused%'
  ) THEN
    ALTER TABLE hana_quest_statuses
      DROP CONSTRAINT hana_quest_statuses_status_check;
    ALTER TABLE hana_quest_statuses
      ADD CONSTRAINT hana_quest_statuses_status_check
      CHECK (status IN ('pending', 'completed', 'skipped', 'paused'));
  END IF;
END $$;
