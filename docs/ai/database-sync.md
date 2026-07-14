# Database Sync (Technical)

Technical source of truth for Hanafy's lightweight cloud persistence.

## Summary

The app is DB-first in production: Neon/Postgres is the authoritative source of
Hana state. `localStorage` remains only as an offline/cache fallback. Production
builds read and write Hana state through a Vercel serverless function.

Hana state is consent-first: no normal DB write happens until Hana chooses
`HanaGameState.startDate`. Preview/explore state stays session-only.

There is no login or auth layer. Static profile ids are used:

```ts
type HanaProfileId = 'hana' | 'cramble'
```

Only `hana` is currently wired in the UI. `cramble` is reserved for the future.

## Files

- `src/lib/hanaCloudSync.ts` builds a database-ready sync payload from
  `HanaGameState` and the quest catalog.
- `src/lib/hanaRemoteState.ts` loads/saves the authoritative DB snapshot and
  chooses DB state before cache/initial state. It also clears Hana DB rows before
  the first committed start date.
- `src/App.tsx` loads DB state on startup/resume, writes changes to DB, and uses
  `localStorage` only as cache/fallback.
- `api/hana-sync.ts` is the Vercel API route. It creates tables if needed and
  reads/upserts snapshots, quest statuses, and weed statuses.
- `src/lib/hanaCloudSync.test.ts` verifies the sync payload.

## Runtime flow

1. App startup calls `GET /api/hana-sync?profileId=hana`.
2. If no started DB snapshot exists, Home -> Hana shows the start-date setup page.
3. Preview mode can open the app without DB writes.
4. When Hana chooses her first day, the app calls `DELETE /api/hana-sync?profileId=hana`
   to clear old rows, then `POST /api/hana-sync` to save the fresh started state.
5. If a DB snapshot exists with `state.startDate`, it becomes `HanaGameState` and overwrites the local
   cache.
6. Hana taps a quest, skip, or weed.
7. `App.tsx` computes the next `HanaGameState` and updates UI/local cache
   immediately.
8. Production saves the newest queued state with `POST /api/hana-sync` in the
   background.
9. If multiple taps happen quickly, `pendingDbSaveRef` keeps only the latest state
   while `isDbSaveInFlightRef` serializes writes so stale requests do not race the
   latest snapshot.
10. If offline or DB fails, the local cache can be shown temporarily, but the next
   successful DB refresh is authoritative.

Local dev does not call the backend because `import.meta.env.DEV` disables cloud
sync. This keeps `npm run dev` quiet when no database is configured.

Manual refresh is available from Hana's page. It reads the latest DB snapshot and
shows one of these states:

- `idle`
- `loading`
- `syncing`
- `synced`
- `error`
- `offline`
- `disabled`
- `preview`

## Source of truth

Current rule: Postgres wins whenever online. If database state and local cache
disagree, the app uses the database state and rewrites local cache.

## Payload

`createHanaCloudSyncPayload('hana', state, quests)` returns:

```ts
type HanaCloudSyncPayload = {
  profileId: 'hana' | 'cramble'
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: HanaGameState
  questStatuses: HanaQuestSyncRow[]
  weedStatuses: HanaWeedSyncRow[]
}
```

The payload's `state.startDate` must be a string. The API rejects `POST` payloads
without it so unstarted preview state cannot become authoritative history.

Quest rows use:

```ts
status: 'pending' | 'completed' | 'skipped'
```

Daily quest `periodKey` is the date key. Long-term quest `periodKey` is the
window start date.

## Database tables

The API route auto-creates these tables:

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

`hana_state_snapshots.state` is a full backup of the current local state.
`hana_quest_statuses` and `hana_weed_statuses` are the analytics-friendly tables
for future graph pages.

## Environment variables

The API reads either:

- `DATABASE_URL`
- `POSTGRES_URL`

Prefer `DATABASE_URL` for a Neon Postgres connection string. Vercel integrations
may also expose `POSTGRES_URL`; the route supports both.

## Deployment on Vercel

1. In Vercel, open the Hanafy project.
2. Add a Postgres database from Vercel Storage / Marketplace. Neon Postgres is a
   good free option.
3. Connect that database to the Hanafy project.
4. Confirm the project has `DATABASE_URL` or `POSTGRES_URL` in Environment
   Variables.
5. Redeploy the project.
6. Open the deployed app, change one Hana quest, then inspect the database.

The first successful sync creates the tables automatically.

## Security note

There is intentionally no login or write key right now because this is a private
link shared only by Hana and Cramble. If the link becomes public, add at least a
small write secret or PIN before relying on the endpoint.
