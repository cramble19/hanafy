# Database Sync (Technical)

Technical source of truth for profile-aware cloud persistence.

## Model

Production is DB-first. Postgres stores one current snapshot per profile plus
analytics-friendly quest and weed rows. The two supported profile ids are:

```ts
type HanaProfileId = 'hana' | 'cramble'
```

The historical `Hana*` type/function names remain for compatibility, but the
endpoint and generic payload/save helpers support both profiles.

## Client boundaries

| Concern | Hana | Cramble |
|---|---|---|
| Controller | `src/App.tsx` | `src/features/cramble/CrambleExperience.tsx` |
| Cache | `hana-game/v1` | `cramble-game/v1` |
| Durable pending snapshot | `hana-game/pending-v1` | `cramble-game/pending-v1` |
| Catalog | `src/data/quests.ts` | `src/data/crambleQuests.ts` |
| Profile id | `hana` | `cramble` |
| Save queue | Hana-owned refs | Cramble-owned refs |

The controllers must not share state, caches, or pending/in-flight refs.

Schema version 5 fields (`openActivities`, `openActivityLogs`, `dailyEmotions`, `habitSettings`,
`questActivations`, finite completion criteria and graduation history,
profile/habit pause intervals, archive state, reminder intent, deletion
tombstones, history epoch, sync revision, and backfill audit) live inside the
same JSONB snapshot and therefore use the serialized cache/pending/POST flow.
Legacy snapshots normalize to safe empty/default collections. The API rejects
future schemas and prevents an older client from overwriting a newer snapshot.

## Relevant files

- `src/lib/hanaCloudSync.ts`
  - `createProfileCloudSyncPayload(profileId, state, quests)` builds rows from
    the explicitly supplied profile and catalog.
  - `createHanaCloudSyncPayload()` is a compatibility wrapper.
- `src/lib/hanaRemoteState.ts`
  - `loadHanaStateFromDb(profileId)` validates that the returned snapshot profile
    equals the requested profile.
  - `saveProfileStateToDb(state, profileId, catalog)` is the generic save path.
  - `saveHanaStateToDb()` supplies Hana's catalog for existing code.
- `api/hana-sync.ts` serves GET, POST, and OPTIONS. There is deliberately no
  profile-wide DELETE route.

POST builds one non-interactive Postgres transaction containing snapshot CAS,
tombstone/history-epoch cleanup, refresh of current unresolved rows, weed
replacement, and projection upserts. A unique write token guards every
projection statement so a losing concurrent request is a complete no-op.

## Start and hydration flow

Both profiles are consent-first. A POST requires `state.startDate` to be a string.

Hana can explore without saving, then **Start Health Overhaul** atomically seeds
only `profileId=hana`. Cramble has no preview; opening the Cramble profile and
choosing **Begin the First Oath** atomically seeds only `profileId=cramble`. If an old
unstarted snapshot exists, the client preserves its server revision and replaces
it through POST CAS instead of deleting first.

Production hydration:

1. Read and normalize that profile's durable pending snapshot. If one exists,
   show it and upload it before accepting a database response.
2. If there is no pending snapshot and the browser is online, GET the selected
   profile.
3. If the request fails or the browser is offline, use only that profile's cache
   when available.
4. If GET succeeds with `snapshot: null`, clear only that profile's cache and
   return its unstarted state.
5. Parse the snapshot with the selected profile's base catalog, merge its valid
   custom definitions, move it to the current local date, and save if needed.

Local development skips all API calls and uses the profile-specific cache.

## Optimistic writes and refresh

A quest, skip, weed, custom-habit, occurrence-record, or undo-one mutation
updates React state and the profile cache immediately. In production, its
controller also stores the newest unsaved full state under that profile's
pending key and runs one save at a time.

On reconnect or a later reload, the marked snapshot is normalized to today and
uploaded against the `syncRevision` captured with that exact pending state. A
successful save advances the current and any newer queued state to the returned
revision, and clears the pending key only if it still matches the state just
saved. A 409 never silently rebases stale local state: explicit conflict recovery
exports CSV, stores a JSON backup, and then loads the database copy.

Hydration uses a sequence and local-mutation revision guard. A GET that started
before a newer local change or a newer hydration cannot overwrite the current UI.

Manual refresh first flushes queued local work when possible; otherwise it loads
the database. Focus, visibility, reconnect, and day-change handlers also reconcile
state. Each controller has its own handlers.

## HTTP contract

`GET /api/hana-sync?profileId=hana|cramble`

- Returns `{ ok: true, snapshot: null }` when no row exists.
- Otherwise returns the selected snapshot.

`POST /api/hana-sync`

```ts
type HanaCloudSyncPayload = {
  profileId: 'hana' | 'cramble'
  baseRevision: number
  writeToken: string
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: GameState
  questStatuses: HanaQuestSyncRow[]
  weedStatuses: HanaWeedSyncRow[]
}
```

For Cramble, `totalFlowers`/`flowersEarned` are compatibility field names whose UI
meaning is renown. Cramble currently sends no weed rows.

Built-in schedule metadata remains in code/data catalogs. User-created schedule
metadata lives with each definition in `state.customHabits`, inside the existing
snapshot JSONB. New custom `periodTarget` counts live in
`state.habitOccurrences[date][questId]`; multiple records can share a date.
No SQL column is added. The base and custom definitions are merged before rows
are derived. Ordinary daily and exact-weekday completions use one row for the
scheduled date. A `periodTarget` or legacy `quota` uses one aggregate row per
period:

- `period_key` and `window_start`: inclusive period start;
- `due_date`: inclusive period end;
- `date_key`: `null`;
- `status`: `completed` only after the target count is reached; paused or
  archived unresolved windows use `paused` and are neutral;
- `flowers_earned` for `periodTarget`: zero while partial, then one difficulty
  reward when the full target is complete;
- `flowers_earned` for a legacy `quota`: its original per-occurrence reward,
  capped at the target.

This makes once-or-several-times goals in configurable day/week windows one
reporting outcome rather than a collection of false daily misses. Partial
progress has no penalty. The full dated boolean and counted occurrence history
remains in the snapshot. Old snapshots without `habitOccurrences` normalize it
to an empty record, while legacy quota history keeps its original meaning. The
API applies additive migrations for revision, write-token, history-epoch, and
paused-status support.

Deadline-free definitions live in `state.openActivities`, with positive logical
day values in `state.openActivityLogs[date][activityId]`. They use the same full
snapshot, local cache, pending marker, revision CAS, and profile isolation. They
do not create `hana_quest_statuses` rows because that projection represents
scored goal windows; Ledger/export analytics read their snapshot history
directly. No SQL migration is required.

The API accepts only supported state schema versions (currently 1 through 3),
and the snapshot upsert also compares the incoming version with the stored one.
A POST whose schema is older than the current snapshot updates zero rows and
returns the normal 409 conflict response. This protects version-3 fields from
an older cached PWA client that does not know how to preserve them and prevents
an unsupported future version from locking legitimate clients out.

The API rejects the whole POST if the profile is invalid, `startDate` is missing,
or any quest/weed row is malformed or carries a different profile. Inserts derive
`profile_id` from the top-level payload rather than trusting child rows.

All API responses send `Cache-Control: no-store` so profile snapshots are not
stored by intermediary/browser HTTP caches. The PWA service worker also leaves
the endpoint network-only.

## Tables

The route creates shared tables on first use:

```sql
hana_state_snapshots (
  profile_id text primary key,
  current_date_key text not null,
  total_flowers integer not null,
  state jsonb not null,
  revision integer not null,
  write_token text not null,
  synced_at timestamptz not null
)
```

```sql
hana_quest_statuses (
  profile_id text not null,
  quest_group text not null,
  quest_id text not null,
  period_key text not null,
  date_key text,
  window_start text,
  due_date text,
  status text not null, -- pending|completed|skipped|paused
  flowers_earned integer not null,
  history_epoch text not null,
  synced_at timestamptz not null,
  primary key (profile_id, quest_group, quest_id, period_key)
)
```

```sql
hana_weed_statuses (
  profile_id text not null,
  date_key text not null,
  weed_id text not null,
  checked boolean not null,
  synced_at timestamptz not null,
  primary key (profile_id, date_key, weed_id)
)
```

Table names are historical; `profile_id` is the data-partition boundary. The API
adds missing columns/paused-status constraints to existing deployments and wraps
each accepted snapshot plus its projection changes in one transaction. Revision
CAS rejects a full snapshot whose captured base is stale.

## Environment and deployment

The API accepts either `DATABASE_URL` or `POSTGRES_URL`. Connect a Postgres
database (for example Neon) to the Vercel project, set one variable, and redeploy.
The first successful call creates the tables.

## Security

There is no authenticated identity or authorization. The `hana` and `cramble`
values prevent accidental state mixing but are publicly selectable API inputs.
The app currently has no profile authentication protecting this endpoint.

Before public or sensitive deployment, add server-validated sessions, bind each
session to one profile, authorize GET/POST, protect mutating requests,
avoid caching responses, and move secrets out of client code.
