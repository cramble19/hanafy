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
  - `clearHanaStateFromDb(profileId)` deletes only one profile.
- `api/hana-sync.ts` serves GET, POST, DELETE, and OPTIONS.

## Start and hydration flow

Both profiles are consent-first. A POST requires `state.startDate` to be a string.

Hana can explore without saving, then **Start Health Overhaul** clears and seeds
only `profileId=hana`. Cramble has no preview; after the client gate,
**Begin the First Oath** clears and seeds only `profileId=cramble`.

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
uploaded before accepting an older database snapshot. A successful save clears
the pending key only if it still matches the state just saved, so a newer tap
cannot be cleared by an older request. This is a last-write snapshot retry, not
an operation-by-operation merge log.

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
- `status`: completed only after the target count is reached;
- `flowers_earned` for `periodTarget`: zero while partial, then one difficulty
  reward when the full target is complete;
- `flowers_earned` for a legacy `quota`: its original per-occurrence reward,
  capped at the target.

This makes once-or-several-times goals in configurable day/week windows one
reporting outcome rather than a collection of false daily misses. Partial
progress has no penalty. The full dated boolean and counted occurrence history
remains in the snapshot. Old snapshots without `habitOccurrences` normalize it
to an empty record, while legacy quota history keeps its original meaning. No
database migration is required.

The API rejects the whole POST if the profile is invalid, `startDate` is missing,
or any quest/weed row is malformed or carries a different profile. Inserts derive
`profile_id` from the top-level payload rather than trusting child rows.

`DELETE /api/hana-sync?profileId=hana|cramble`

- Deletes snapshot, quest rows, and weed rows only for the requested profile.

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
  status text not null,
  flowers_earned integer not null,
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

Table names are historical; `profile_id` is the ownership boundary. Existing
deployments require no table migration for Cramble.

Snapshot and analytics upserts are not wrapped in one database transaction. A
failure after the snapshot write can leave analytics rows temporarily behind the
snapshot; the next full save repairs upserted rows. Treat transactional writes as
future hardening.

## Environment and deployment

The API accepts either `DATABASE_URL` or `POSTGRES_URL`. Connect a Postgres
database (for example Neon) to the Vercel project, set one variable, and redeploy.
The first successful call creates the tables.

## Security

There is no authenticated identity or authorization. The `hana` and `cramble`
values prevent accidental state mixing but are publicly selectable API inputs.
Cramble's `hana` password is client-side and does not protect this endpoint.

Before public or sensitive deployment, add server-validated sessions, bind each
session to one profile, authorize GET/POST/DELETE, protect mutating requests,
avoid caching responses, and move secrets out of client code.
