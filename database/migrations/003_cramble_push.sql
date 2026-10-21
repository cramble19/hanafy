-- Notification preferences are separate from every saved habit/mood/counter.
CREATE TABLE IF NOT EXISTS cramble_push_devices (
  id text PRIMARY KEY,
  subscription jsonb NOT NULL,
  schedule jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_slot text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
