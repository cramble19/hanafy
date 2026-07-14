# Database Sync (Technical)

Technical source of truth for Hanafy's lightweight cloud persistence.

## Summary

The app remains local-first: `localStorage` is still the immediate source of UI
state and offline behavior. Production builds also sync Hana's latest state to a
Postgres database through a Vercel serverless function.

There is no login or auth layer. Static profile ids are used:

```ts
type HanaProfileId = 'hana' | 'cramble'
```

Only `hana` is currently wired in the UI. `cramble` is reserved for the future.

## Files

- `src/lib/hanaCloudSync.ts` builds a database-ready sync payload from
  `HanaGameState` and the quest catalog.
- `src/App.tsx` debounces production sync calls to `/api/hana-sync` and retries
  on app focus, visibility resume, and `online`. It also exposes a manual sync
  action to `HanaPage`.
- `api/hana-sync.ts` is the Vercel API route. It creates tables if needed and
  upserts snapshots, quest statuses, and weed statuses.
- `src/lib/hanaCloudSync.test.ts` verifies the sync payload.

## Runtime flow

1. Hana taps a quest, skip, or weed.
2. `App.tsx` updates `HanaGameState`.
3. The state is immediately persisted to `localStorage`.
4. In production only, a debounced sync builds a `HanaCloudSyncPayload`.
5. The browser sends `POST /api/hana-sync`.
6. The Vercel function writes to Postgres.

Local dev does not call the backend because `import.meta.env.DEV` disables cloud
sync. This keeps `npm run dev` quiet when no database is configured.

Manual sync is available from Hana's page. It uses the same upload path and shows
one of these states:

- `idle`
- `syncing`
- `synced`
- `error`
- `offline`
- `disabled`

## Source of truth

Current rule: local `HanaGameState` wins. The database is a mirror/history layer
for future statistics. If local state and database rows disagree, the next auto
sync or manual **Sync** tap uploads the local state to Postgres.

To make Postgres the source of truth later, add a `GET /api/hana-sync?profileId=hana`
endpoint, store local `lastSyncedAt` metadata, and define a conflict policy before
overwriting local state.

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
