import { neon } from '@neondatabase/serverless'

type ApiRequest = {
  method?: string
  body?: unknown
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
  status: 'pending' | 'completed' | 'skipped'
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
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: unknown
  questStatuses: QuestStatus[]
  weedStatuses: WeedStatus[]
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const payload = parsePayload(req.body)
  if (!payload) {
    res.status(400).json({ error: 'Invalid Hana sync payload' })
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

    await sql`
      INSERT INTO hana_state_snapshots (
        profile_id,
        current_date,
        total_flowers,
        state,
        synced_at
      )
      VALUES (
        ${payload.profileId},
        ${payload.currentDate},
        ${payload.totalFlowers},
        ${JSON.stringify(payload.state)}::jsonb,
        ${payload.syncedAt}::timestamptz
      )
      ON CONFLICT (profile_id)
      DO UPDATE SET
        current_date = EXCLUDED.current_date,
        total_flowers = EXCLUDED.total_flowers,
        state = EXCLUDED.state,
        synced_at = EXCLUDED.synced_at
    `

    await Promise.all(
      payload.questStatuses.map((row) =>
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
            synced_at
          )
          VALUES (
            ${row.profileId},
            ${row.questGroup},
            ${row.questId},
            ${row.periodKey},
            ${row.dateKey},
            ${row.windowStart},
            ${row.dueDate},
            ${row.status},
            ${row.flowersEarned},
            ${payload.syncedAt}::timestamptz
          )
          ON CONFLICT (profile_id, quest_group, quest_id, period_key)
          DO UPDATE SET
            date_key = EXCLUDED.date_key,
            window_start = EXCLUDED.window_start,
            due_date = EXCLUDED.due_date,
            status = EXCLUDED.status,
            flowers_earned = EXCLUDED.flowers_earned,
            synced_at = EXCLUDED.synced_at
        `,
      ),
    )

    await Promise.all(
      payload.weedStatuses.map((row) =>
        sql`
          INSERT INTO hana_weed_statuses (
            profile_id,
            date_key,
            weed_id,
            checked,
            synced_at
          )
          VALUES (
            ${row.profileId},
            ${row.dateKey},
            ${row.weedId},
            ${row.checked},
            ${payload.syncedAt}::timestamptz
          )
          ON CONFLICT (profile_id, date_key, weed_id)
          DO UPDATE SET
            checked = EXCLUDED.checked,
            synced_at = EXCLUDED.synced_at
        `,
      ),
    )

    res.status(200).json({
      ok: true,
      questRows: payload.questStatuses.length,
      weedRows: payload.weedStatuses.length,
    })
  } catch (error) {
    console.error('Hana sync failed', error)
    res.status(500).json({ error: 'Hana sync failed' })
  }
}

type NeonSql = ReturnType<typeof neon<false, false>>

async function ensureTables(sql: NeonSql) {
  await sql`
    CREATE TABLE IF NOT EXISTS hana_state_snapshots (
      profile_id text PRIMARY KEY,
      current_date text NOT NULL,
      total_flowers integer NOT NULL,
      state jsonb NOT NULL,
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
      status text NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
      flowers_earned integer NOT NULL DEFAULT 0,
      synced_at timestamptz NOT NULL,
      PRIMARY KEY (profile_id, quest_group, quest_id, period_key)
    )
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
}

function parsePayload(body: unknown): SyncPayload | null {
  const value = typeof body === 'string' ? parseJson(body) : body
  if (!isRecord(value)) {
    return null
  }

  if (value.profileId !== 'hana' && value.profileId !== 'cramble') {
    return null
  }

  if (
    typeof value.syncedAt !== 'string' ||
    typeof value.currentDate !== 'string' ||
    typeof value.totalFlowers !== 'number' ||
    !Array.isArray(value.questStatuses) ||
    !Array.isArray(value.weedStatuses)
  ) {
    return null
  }

  const questStatuses = value.questStatuses.filter(isQuestStatus)
  const weedStatuses = value.weedStatuses.filter(isWeedStatus)

  return {
    profileId: value.profileId,
    syncedAt: value.syncedAt,
    currentDate: value.currentDate,
    totalFlowers: value.totalFlowers,
    state: value.state ?? {},
    questStatuses,
    weedStatuses,
  }
}

function isQuestStatus(value: unknown): value is QuestStatus {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.profileId === 'string' &&
    (value.questGroup === 'daily' || value.questGroup === 'longTerm') &&
    typeof value.questId === 'string' &&
    typeof value.periodKey === 'string' &&
    (typeof value.dateKey === 'string' || value.dateKey === null) &&
    (typeof value.windowStart === 'string' || value.windowStart === null) &&
    (typeof value.dueDate === 'string' || value.dueDate === null) &&
    (value.status === 'pending' ||
      value.status === 'completed' ||
      value.status === 'skipped') &&
    typeof value.flowersEarned === 'number'
  )
}

function isWeedStatus(value: unknown): value is WeedStatus {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.profileId === 'string' &&
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
