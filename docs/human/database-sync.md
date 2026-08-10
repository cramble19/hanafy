# Database Sync

In the deployed app, Postgres is the main saved copy of both Hana's and
Cramble's progress. The two paths use separate profiles, so changing a Cramble
quest does not change Hana's garden, and vice versa.

## Separate records

- Hana uses the `hana` database profile and the device cache `hana-game/v1`.
- Cramble uses the `cramble` database profile and the device cache
  `cramble-game/v1`.
- Both profiles keep their newest unsaved snapshot under separate pending keys
  so an offline edit can be retried after leaving or reopening the screen.
- Each path has its own start date, quest catalog, current plan, completions,
  skips, reward balance, and background save queue.
- Habit timing is stored with dated progress. Ordinary habits keep a done/not
  done record; flexible custom goals keep the number of times recorded each day,
  including several records on one day.
- The saved active date follows the shared local tracking day: 4:00 AM through
  3:59 AM the next calendar day. The API stores this key rather than calculating
  a separate server-side date.
- A flexible day/week target is summarized as one whole period. Partial progress
  earns no partial reward and has no penalty, and unused days are not mislabeled
  as separate failures.
- Hana also saves Evening Weeds. Cramble does not use them in the first chapter.

## When saving begins

Hana is not written to the database until **Start Health Overhaul** is pressed.
Her Explore mode remains temporary.

Cramble is not written until **Begin the First Oath** is pressed. Starting or
resetting either profile replaces that profile
with one revision-checked transaction; it never clears the durable copy before
the replacement has succeeded.

## What gets saved

The app saves the active date and due quest plan, custom habit definitions,
completed and skipped quests, counted custom-habit records, flexible period
progress, compatibility long-term windows, weekly skip history, the reward
balance, and the full state needed to restore the experience. Hana's weed checks
are also stored. Habit cues, reminder intent, archive state, individual pause
intervals, profile-wide pause intervals and their reason, and backfill audit
timestamps live in the same profile snapshot. Older snapshots are normalized to
safe active/default lifecycle values without losing their original history.

Snapshot and analytics changes commit in one database transaction. Permanent
habit deletion carries a tombstone that removes the matching derived rows. A
full progress reset changes a history epoch, which retires older projections
inside that same transaction without exposing an empty or partly reset profile.

## Sync behavior

Quest taps update the screen and local cache immediately, then save quietly in
the background when a connection is available. Every offline/pending snapshot
keeps the exact database revision it was based on. The server accepts it only if
that revision is still current, so a stale tab cannot resurrect deleted data.
On a conflict, Sync first downloads a CSV, keeps a JSON recovery copy, and asks
before loading the newer database version. Opening, focusing, reconnecting,
changing day, or pressing Refresh can reconcile the profile with the database.

When online, the database is authoritative unless that profile has a marked
unsaved snapshot. That snapshot is uploaded first, before an older database copy
can be shown. If a successful lookup finds no record for that profile, only that
profile's device cache is cleared and its start page is shown. When offline or a
request fails, the separate local cache can be used temporarily.

Local development deliberately disables cloud sync and keeps both profiles on
the current device.

## Security

The database endpoint has no account authentication yet, and the local cache is
not encrypted.
Use a server-validated session system before treating this as private or sharing
the deployment publicly.

Vercel hosts the small API endpoint. The database is a connected Postgres
database such as Neon.
