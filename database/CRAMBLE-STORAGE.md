# Cramble storage separation

Migration `002_cramble_domains.sql` is additive and Cramble-only. It creates:

- `cramble_habit_state`: anytime habit definitions, daily values and Rhythm categories.
- `cramble_observatory_state`: lesson definitions, activation, completion, skips and renown.
- `cramble_domain_history`: immutable checkpoints with independent per-domain revisions.

Each table also owns its ID-filtered lifecycle settings, deletion tombstones and
backfill audit. Classification uses immutable IDs, never task titles. A habit and
an Observatory lesson may both be called Gym. Rhythm lists habits only.

The existing profile snapshot and every historical snapshot are retained unchanged
by the migration. Common profile metadata (dates, emotions, Someday, profile-wide
pause, sync revision and the compatibility lifecycle index) stays in the profile
snapshot. Hana's reads, writes and appearance are unchanged.

The existing revision-checked, idempotent save transaction remains the compatibility
write boundary. A database trigger synchronizes both domains atomically, including
writes from an older frontend during deployment. Only changed domain content advances
that domain's revision or adds a history checkpoint. Three-way offline reconciliation
still merges independent activity, lesson and emotion changes before retrying a save.
Cramble reads its domain content through `cramble_composed_state`; the view falls back
to the complete snapshot if a domain's source revision is unavailable.

## Deployment and recovery

1. Rehearse the migration and `tests/cramble_domains.sql` in a transaction ending
   in `ROLLBACK`. The tests mutate a temporary source row, never real profile rows.
2. Compare profile snapshot fingerprints, revisions and original history counts.
3. Apply migration 002 in one transaction **before** deploying the API using its view.
4. Verify the composed state equals the retained snapshot, then deploy the frontend.

The migration never deletes logs, renames records, resets progress or overwrites
the existing snapshot. An application rollback can continue using the old snapshot
API; leave the additive tables and trigger in place. Do not drop storage as a rollback.
