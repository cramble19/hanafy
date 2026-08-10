import { neon } from '@neondatabase/serverless'

const CURRENT_STATE_SCHEMA_VERSION = 5

type ApiRequest = {
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  setHeader(name: string, value: string): void
  status(code: number): ApiResponse
  json(body: unknown): void
  end(): void
}

type QuestStatus = {
  profileId: string
  questGroup: 'daily' | 'longTerm'
  questId: string
  periodKey: string
  dateKey: string | null
  windowStart: string | null
  dueDate: string | null
  status: 'pending' | 'completed' | 'skipped' | 'paused'
  flowersEarned: number
}

type WeedStatus = {
  profileId: string
  dateKey: string
  weedId: string
  checked: boolean
}

type SyncPayload = {
  profileId: 'hana' | 'cramble'
  baseRevision: number
  stateSchemaVersion: number
  writeToken: string
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: unknown
  questStatuses: QuestStatus[]
  weedStatuses: WeedStatus[]
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'GET, POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!databaseUrl) {
    res.status(500).json({ error: 'Missing DATABASE_URL or POSTGRES_URL' })
    return
  }

  try {
    const sql = neon(databaseUrl)
    await ensureTables(sql)

    if (req.method === 'GET') {
      const profileId = readProfileId(req.query?.profileId)
      if (!profileId) {
        res.status(400).json({ error: 'Invalid profileId' })
        return
      }

      const rows = await sql`
        SELECT
          profile_id,
          current_date_key,
          total_flowers,
          state,
          revision,
          synced_at
        FROM hana_state_snapshots
        WHERE profile_id = ${profileId}
        LIMIT 1
      `
      const snapshot = rows[0]

      if (!isSnapshotRow(snapshot)) {
        res.status(200).json({ ok: true, snapshot: null })
        return
      }

      res.status(200).json({
        ok: true,
        snapshot: {
          profileId: snapshot.profile_id,
          currentDate: snapshot.current_date_key,
          totalFlowers: snapshot.total_flowers,
          state: snapshot.state,
          revision: snapshot.revision,
          syncedAt: formatSyncedAt(snapshot.synced_at),
        },
      })
      return
    }

    const payload = parsePayload(req.body)
    if (!payload) {
      res.status(400).json({ error: 'Invalid profile sync payload' })
      return
    }

    const deletedHabitIds = readDeletedHabitIds(payload.state)
    const historyEpoch = readHistoryEpoch(payload.state)
    const syncQueries = [sql`
      INSERT INTO hana_state_snapshot_history (
        profile_id,
        revision,
        current_date_key,
        total_flowers,
        state,
        write_token,
        synced_at
      )
      SELECT
        profile_id,
        revision,
        current_date_key,
        total_flowers,
        state,
        write_token,
        synced_at
      FROM hana_state_snapshots
      WHERE profile_id = ${payload.profileId}
        AND revision = ${payload.baseRevision}
      ON CONFLICT (profile_id, revision) DO NOTHING
    `, sql`
      INSERT INTO hana_state_snapshots (
        profile_id,
        current_date_key,
        total_flowers,
        state,
        revision,
        write_token,
        synced_at
      )
      SELECT
        ${payload.profileId},
        ${payload.currentDate},
        ${payload.totalFlowers},
        ${JSON.stringify(payload.state)}::jsonb,
        1,
        ${payload.writeToken},
        ${payload.syncedAt}::timestamptz
      WHERE ${payload.baseRevision} = 0
      ON CONFLICT (profile_id)
      DO UPDATE SET
        current_date_key = EXCLUDED.current_date_key,
        total_flowers = EXCLUDED.total_flowers,
        state = EXCLUDED.state,
        revision = hana_state_snapshots.revision + 1,
        write_token = EXCLUDED.write_token,
        synced_at = EXCLUDED.synced_at
      WHERE hana_state_snapshots.revision = ${payload.baseRevision}
        AND COALESCE(
          CASE
            WHEN jsonb_typeof(hana_state_snapshots.state -> 'schemaVersion') = 'number'
              THEN (hana_state_snapshots.state ->> 'schemaVersion')::integer
            ELSE 1
          END,
          1
        ) <= ${payload.stateSchemaVersion}
      RETURNING revision, synced_at
    `]

    // Keep every accepted revision as a recoverable checkpoint. This is
    // separate from the analytical projections and is never sent to clients.
    syncQueries.push(sql`
      INSERT INTO hana_state_snapshot_history (
        profile_id,
        revision,
        current_date_key,
        total_flowers,
        state,
        write_token,
        synced_at
      )
      SELECT
        profile_id,
        revision,
        current_date_key,
        total_flowers,
        state,
        write_token,
        synced_at
      FROM hana_state_snapshots
      WHERE profile_id = ${payload.profileId}
        AND write_token = ${payload.writeToken}
      ON CONFLICT (profile_id, revision) DO NOTHING
    `)

    // A deleted built-in remains in source code, so the snapshot carries a
    // tombstone. Remove only those quest projections; other historical rows
    // (notably expired long-term windows) cannot always be reconstructed.
    deletedHabitIds.forEach((habitId) => {
      syncQueries.push(sql`
        DELETE FROM hana_quest_statuses
        WHERE profile_id = ${payload.profileId}
          AND quest_id = ${habitId}
          AND EXISTS (
            SELECT 1 FROM hana_state_snapshots
            WHERE profile_id = ${payload.profileId}
              AND write_token = ${payload.writeToken}
          )
      `)
    })

    // A reset changes the history epoch. Retire every projection from the old
    // epoch while keeping incomplete long-term history during ordinary saves.
    syncQueries.push(sql`
      DELETE FROM hana_quest_statuses
      WHERE profile_id = ${payload.profileId}
        AND history_epoch <> ${historyEpoch}
        AND EXISTS (
          SELECT 1 FROM hana_state_snapshots
          WHERE profile_id = ${payload.profileId}
            AND write_token = ${payload.writeToken}
        )
    `)

    // Refresh only unresolved rows whose window is still current. Historical
    // pending rows are intentionally retained so their eventual missed status
    // remains available to analytics.
    syncQueries.push(sql`
      DELETE FROM hana_quest_statuses
      WHERE profile_id = ${payload.profileId}
        AND status = 'pending'
        AND (
          date_key = ${payload.currentDate}
          OR (due_date IS NOT NULL AND due_date >= ${payload.currentDate})
        )
        AND EXISTS (
          SELECT 1 FROM hana_state_snapshots
          WHERE profile_id = ${payload.profileId}
            AND write_token = ${payload.writeToken}
        )
    `)

    // Weed rows are fully represented in the snapshot, so replacing them is
    // safe and prevents a reset from leaving stale projection rows.
    syncQueries.push(sql`
      DELETE FROM hana_weed_statuses
      WHERE profile_id = ${payload.profileId}
        AND EXISTS (
          SELECT 1 FROM hana_state_snapshots
          WHERE profile_id = ${payload.profileId}
            AND write_token = ${payload.writeToken}
        )
    `)

    payload.questStatuses.forEach((row) => {
      syncQueries.push(
        sql`
          INSERT INTO hana_quest_statuses (
            profile_id,
            quest_group,
            quest_id,
            period_key,
            date_key,
            window_start,
            due_date,
            status,
            flowers_earned,
            history_epoch,
            synced_at
          )
          SELECT
            ${payload.profileId},
            ${row.questGroup},
            ${row.questId},
            ${row.periodKey},
            ${row.dateKey},
            ${row.windowStart},
            ${row.dueDate},
            ${row.status},
            ${row.flowersEarned},
            ${historyEpoch},
            ${payload.syncedAt}::timestamptz
          WHERE EXISTS (
            SELECT 1 FROM hana_state_snapshots
            WHERE profile_id = ${payload.profileId}
              AND write_token = ${payload.writeToken}
          )
          ON CONFLICT (profile_id, quest_group, quest_id, period_key)
          DO UPDATE SET
            date_key = EXCLUDED.date_key,
            window_start = EXCLUDED.window_start,
            due_date = EXCLUDED.due_date,
            status = EXCLUDED.status,
            flowers_earned = EXCLUDED.flowers_earned,
            history_epoch = EXCLUDED.history_epoch,
            synced_at = EXCLUDED.synced_at
        `,
      )
    })

    payload.weedStatuses.forEach((row) => {
      syncQueries.push(
        sql`
          INSERT INTO hana_weed_statuses (
            profile_id,
            date_key,
            weed_id,
            checked,
            synced_at
          )
          SELECT
            ${payload.profileId},
            ${row.dateKey},
            ${row.weedId},
            ${row.checked},
            ${payload.syncedAt}::timestamptz
          WHERE EXISTS (
            SELECT 1 FROM hana_state_snapshots
            WHERE profile_id = ${payload.profileId}
              AND write_token = ${payload.writeToken}
          )
          ON CONFLICT (profile_id, date_key, weed_id)
          DO UPDATE SET
            checked = EXCLUDED.checked,
            synced_at = EXCLUDED.synced_at
        `,
      )
    })

    const transactionResults = await sql.transaction(syncQueries)
    const snapshotRows = transactionResults[1]
    if (!snapshotRows.length) {
      const currentRows = await sql`
        SELECT revision, write_token
        FROM hana_state_snapshots
        WHERE profile_id = ${payload.profileId}
        LIMIT 1
      `
      if (currentRows[0]?.write_token === payload.writeToken) {
        res.status(200).json({
          ok: true,
          revision: currentRows[0]?.revision,
          questRows: payload.questStatuses.length,
          weedRows: payload.weedStatuses.length,
          idempotent: true,
        })
        return
      }
      res.status(409).json({
        error: 'The profile changed on another device',
        currentRevision:
          typeof currentRows[0]?.revision === 'number'
            ? currentRows[0].revision
            : null,
      })
      return
    }

    res.status(200).json({
      ok: true,
      revision: snapshotRows[0]?.revision,
      questRows: payload.questStatuses.length,
      weedRows: payload.weedStatuses.length,
    })
  } catch (error) {
    console.error('Profile sync failed', error)
    res.status(500).json({ error: 'Profile sync failed' })
  }
}

type NeonSql = ReturnType<typeof neon<false, false>>

async function ensureTables(sql: NeonSql) {
  await sql`
    CREATE TABLE IF NOT EXISTS hana_state_snapshots (
      profile_id text PRIMARY KEY,
      current_date_key text NOT NULL,
      total_flowers integer NOT NULL,
      state jsonb NOT NULL,
      revision integer NOT NULL DEFAULT 1,
      write_token text NOT NULL DEFAULT 'legacy',
      synced_at timestamptz NOT NULL
    )
  `

  await sql`
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
    )
  `

  await sql`
    ALTER TABLE hana_quest_statuses
      ADD COLUMN IF NOT EXISTS history_epoch text NOT NULL DEFAULT 'legacy'
  `

  await sql`
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
    )
  `

  await sql`
    ALTER TABLE hana_state_snapshots
      ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1
  `

  await sql`
    ALTER TABLE hana_state_snapshots
      ADD COLUMN IF NOT EXISTS write_token text NOT NULL DEFAULT 'legacy'
  `

  await sql`
    CREATE TABLE IF NOT EXISTS hana_weed_statuses (
      profile_id text NOT NULL,
      date_key text NOT NULL,
      weed_id text NOT NULL,
      checked boolean NOT NULL,
      synced_at timestamptz NOT NULL,
      PRIMARY KEY (profile_id, date_key, weed_id)
    )
  `

  await sql`
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
    END $$
  `
}

function parsePayload(body: unknown): SyncPayload | null {
  const value = typeof body === 'string' ? parseJson(body) : body
  if (!isRecord(value)) {
    return null
  }

  if (value.profileId !== 'hana' && value.profileId !== 'cramble') {
    return null
  }
  const profileId = value.profileId
  const stateSchemaVersion = readStateSchemaVersion(value.state)

  if (
    typeof value.syncedAt !== 'string' ||
    typeof value.writeToken !== 'string' ||
    value.writeToken.length < 8 ||
    value.writeToken.length > 120 ||
    !Number.isInteger(value.baseRevision) ||
    (value.baseRevision as number) < 0 ||
    typeof value.currentDate !== 'string' ||
    typeof value.totalFlowers !== 'number' ||
    !isRecord(value.state) ||
    stateSchemaVersion === null ||
    !hasRequiredStateShape(
      value.state,
      stateSchemaVersion,
      value.currentDate,
      value.totalFlowers,
    ) ||
    typeof value.state.startDate !== 'string' ||
    !Array.isArray(value.questStatuses) ||
    !Array.isArray(value.weedStatuses)
  ) {
    return null
  }

  const questStatuses = value.questStatuses.filter((row) =>
    isQuestStatus(row, profileId),
  )
  const weedStatuses = value.weedStatuses.filter((row) =>
    isWeedStatus(row, profileId),
  )

  if (
    questStatuses.length !== value.questStatuses.length ||
    weedStatuses.length !== value.weedStatuses.length
  ) {
    return null
  }

  return {
    profileId,
    baseRevision: value.baseRevision as number,
    stateSchemaVersion,
    writeToken: value.writeToken,
    syncedAt: value.syncedAt,
    currentDate: value.currentDate,
    totalFlowers: value.totalFlowers,
    state: value.state,
    questStatuses,
    weedStatuses,
  }
}

function readProfileId(value: string | string[] | undefined) {
  const profileId = Array.isArray(value) ? value[0] : value
  return profileId === 'hana' || profileId === 'cramble' ? profileId : null
}

function readStateSchemaVersion(state: unknown) {
  if (!isRecord(state)) return null
  if (state.schemaVersion === undefined) return 1
  return Number.isInteger(state.schemaVersion) &&
    (state.schemaVersion as number) >= 1 &&
    (state.schemaVersion as number) <= CURRENT_STATE_SCHEMA_VERSION
    ? (state.schemaVersion as number)
    : null
}

function hasRequiredStateShape(
  state: Record<string, unknown>,
  schemaVersion: number,
  currentDate: string,
  totalFlowers: number,
) {
  if (
    state.currentDate !== currentDate ||
    state.totalFlowers !== totalFlowers ||
    !Array.isArray(state.customHabits) ||
    !isRecord(state.activeDailyQuests) ||
    !Array.isArray(state.activeLongTermQuestIds) ||
    !isRecord(state.dailyCompletions) ||
    !isRecord(state.habitOccurrences) ||
    !isRecord(state.longTermWindows) ||
    !isRecord(state.longTermCompletions) ||
    !isRecord(state.questSkips) ||
    !isRecord(state.eveningWeeds)
  ) {
    return false
  }

  if (
    schemaVersion >= 3 &&
    (!Array.isArray(state.openActivities) || !isRecord(state.openActivityLogs))
  ) {
    return false
  }

  if (schemaVersion >= 4 && !isRecord(state.questActivations)) return false
  return schemaVersion < 5 || isRecord(state.dailyEmotions)
}

function readDeletedHabitIds(state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.deletedHabitIds)) return []
  return state.deletedHabitIds
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0 && value.length <= 120,
    )
    .slice(-500)
}

function readHistoryEpoch(state: unknown) {
  if (!isRecord(state)) return 'legacy'
  const value = state.historyEpoch
  return typeof value === 'string' && value.length > 0 && value.length <= 120
    ? value
    : 'legacy'
}

function isSnapshotRow(value: unknown): value is {
  profile_id: string
  current_date_key: string
  total_flowers: number
  state: unknown
  revision: number
  synced_at: string | Date
} {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.profile_id === 'string' &&
    typeof value.current_date_key === 'string' &&
    typeof value.total_flowers === 'number' &&
    isRecord(value.state) &&
    typeof value.revision === 'number' &&
    (typeof value.synced_at === 'string' || value.synced_at instanceof Date)
  )
}

function formatSyncedAt(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value
}

function isQuestStatus(
  value: unknown,
  profileId: SyncPayload['profileId'],
): value is QuestStatus {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.profileId === profileId &&
    (value.questGroup === 'daily' || value.questGroup === 'longTerm') &&
    typeof value.questId === 'string' &&
    typeof value.periodKey === 'string' &&
    (typeof value.dateKey === 'string' || value.dateKey === null) &&
    (typeof value.windowStart === 'string' || value.windowStart === null) &&
    (typeof value.dueDate === 'string' || value.dueDate === null) &&
    (value.status === 'pending' ||
      value.status === 'completed' ||
      value.status === 'skipped' ||
      value.status === 'paused') &&
    typeof value.flowersEarned === 'number'
  )
}

function isWeedStatus(
  value: unknown,
  profileId: SyncPayload['profileId'],
): value is WeedStatus {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.profileId === profileId &&
    typeof value.dateKey === 'string' &&
    typeof value.weedId === 'string' &&
    typeof value.checked === 'boolean'
  )
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
