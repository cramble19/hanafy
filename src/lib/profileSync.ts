import type { HanaGameState } from '@/types'

export const PENDING_PROFILE_SYNC_FORMAT = 'hanafy-pending-profile-sync' as const
export const PENDING_PROFILE_SYNC_VERSION = 1 as const

export type PendingProfileSync = {
  format: typeof PENDING_PROFILE_SYNC_FORMAT
  version: typeof PENDING_PROFILE_SYNC_VERSION
  state: HanaGameState
  baseState: HanaGameState | null
  writeToken: string
  queuedAt: string
  attempted: boolean
}

type StateParser = (raw: string) => HanaGameState | null

export function createProfileSyncToken() {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `sync-${randomId}`
}

export function queuePendingProfileSync(
  previousState: HanaGameState,
  nextState: HanaGameState,
  existing: PendingProfileSync | null,
  now = new Date().toISOString(),
): PendingProfileSync {
  if (!existing) {
    return {
      format: PENDING_PROFILE_SYNC_FORMAT,
      version: PENDING_PROFILE_SYNC_VERSION,
      state: nextState,
      baseState: previousState,
      writeToken: createProfileSyncToken(),
      queuedAt: now,
      attempted: false,
    }
  }

  return {
    ...existing,
    state: nextState,
    writeToken: existing.attempted
      ? createProfileSyncToken()
      : existing.writeToken,
    attempted: false,
  }
}

export function markPendingProfileSyncAttempted(record: PendingProfileSync) {
  return record.attempted ? record : { ...record, attempted: true }
}

export function serializePendingProfileSync(record: PendingProfileSync) {
  return JSON.stringify(record)
}

export function parsePendingProfileSync(
  raw: string | null,
  parseState: StateParser,
): PendingProfileSync | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (isPendingEnvelope(value)) {
      const state = parseState(JSON.stringify(value.state))
      const baseState = value.baseState
        ? parseState(JSON.stringify(value.baseState))
        : null
      if (!state) return null
      return {
        format: PENDING_PROFILE_SYNC_FORMAT,
        version: PENDING_PROFILE_SYNC_VERSION,
        state,
        baseState,
        writeToken: value.writeToken,
        queuedAt: value.queuedAt,
        attempted: value.attempted === true,
      }
    }

    // v1 pending caches stored only the state. Keep that recovery path and
    // rebase it conservatively after fetching the latest database snapshot.
    const legacyState = parseState(raw)
    if (!legacyState) return null
    return {
      format: PENDING_PROFILE_SYNC_FORMAT,
      version: PENDING_PROFILE_SYNC_VERSION,
      state: legacyState,
      baseState: null,
      writeToken: createProfileSyncToken(),
      queuedAt: new Date().toISOString(),
      attempted: false,
    }
  } catch {
    return null
  }
}

export function rebasePendingProfileSync(
  pending: PendingProfileSync,
  remoteState: HanaGameState,
  remoteRevision: number,
): PendingProfileSync | null {
  const localEpoch = pending.state.historyEpoch ?? 'legacy'
  const remoteEpoch = remoteState.historyEpoch ?? 'legacy'
  if (localEpoch !== remoteEpoch) return null

  const merged = pending.baseState
    ? mergeThreeWay(pending.baseState, pending.state, remoteState)
    : mergeLegacyPending(remoteState, pending.state)
  const deletedIds = Array.from(
    new Set([
      ...(remoteState.deletedHabitIds ?? []),
      ...(pending.state.deletedHabitIds ?? []),
      ...(merged.deletedHabitIds ?? []),
    ]),
  )
  const deletedSet = new Set(deletedIds)

  return {
    format: PENDING_PROFILE_SYNC_FORMAT,
    version: PENDING_PROFILE_SYNC_VERSION,
    state: {
      ...merged,
      schemaVersion: Math.max(
        remoteState.schemaVersion ?? 1,
        pending.state.schemaVersion ?? 1,
      ),
      startDate: earliestDate(remoteState.startDate, pending.state.startDate),
      currentDate: [remoteState.currentDate, pending.state.currentDate].sort().at(-1) ??
        pending.state.currentDate,
      syncRevision: remoteRevision,
      deletedHabitIds: deletedIds,
      backfillAudit: dedupeBackfillEvents(merged.backfillAudit ?? []),
      customHabits: merged.customHabits.filter(
        (habit) => !deletedSet.has(habit.id),
      ),
      openActivities: merged.openActivities.filter(
        (activity) => !deletedSet.has(activity.id),
      ),
    },
    baseState: { ...remoteState, syncRevision: remoteRevision },
    writeToken: createProfileSyncToken(),
    queuedAt: pending.queuedAt,
    attempted: false,
  }
}

function dedupeBackfillEvents(events: NonNullable<HanaGameState['backfillAudit']>) {
  const byNaturalKey = new Map<string, (typeof events)[number]>()
  events.forEach((event) => {
    const key = [
      event.habitId,
      event.performedDate,
      event.recordedAt,
      event.delta,
    ].join('|')
    byNaturalKey.set(key, event)
  })
  return Array.from(byNaturalKey.values()).slice(-5_000)
}

export function advancePendingProfileSyncRevision(
  pending: PendingProfileSync,
  previousRevision: number,
  nextRevision: number,
) {
  if ((pending.state.syncRevision ?? 0) !== previousRevision) return pending
  return {
    ...pending,
    state: { ...pending.state, syncRevision: nextRevision },
    baseState: pending.baseState
      ? { ...pending.baseState, syncRevision: nextRevision }
      : null,
  }
}

function mergeThreeWay(
  baseState: HanaGameState,
  localState: HanaGameState,
  remoteState: HanaGameState,
) {
  return mergeValue(baseState, localState, remoteState) as HanaGameState
}

function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (deepEqual(local, base)) return clone(remote)
  if (remote === undefined) return clone(local)
  if (base === undefined && isIdArray(local) && isIdArray(remote)) {
    return mergeIdArrays([], local, remote)
  }
  if (base === undefined && isRecord(local) && isRecord(remote)) {
    return mergeValue({}, local, remote)
  }
  if (isIdArray(base) && isIdArray(local) && isIdArray(remote)) {
    return mergeIdArrays(base, local, remote)
  }
  if (Array.isArray(local)) return clone(local)
  if (!isRecord(local) || !isRecord(base) || !isRecord(remote)) {
    return clone(local)
  }

  const result: Record<string, unknown> = {}
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])
  keys.forEach((key) => {
    const baseHas = Object.hasOwn(base, key)
    const localHas = Object.hasOwn(local, key)
    const remoteHas = Object.hasOwn(remote, key)
    if (!localHas) {
      if (!baseHas && remoteHas) result[key] = clone(remote[key])
      return
    }
    if (!baseHas) {
      result[key] = remoteHas
        ? mergeValue(undefined, local[key], remote[key])
        : clone(local[key])
      return
    }
    const merged = mergeValue(
      base[key],
      local[key],
      remoteHas ? remote[key] : undefined,
    )
    if (merged !== undefined) result[key] = merged
  })
  return result
}

function mergeLegacyPending(remote: HanaGameState, local: HanaGameState) {
  return mergeLegacyValue(remote, local) as HanaGameState
}

function mergeLegacyValue(remote: unknown, local: unknown): unknown {
  if (isIdArray(remote) && isIdArray(local)) {
    const byId = new Map(remote.map((item) => [item.id, clone(item)]))
    local.forEach((item) => byId.set(item.id, clone(item)))
    return Array.from(byId.values())
  }
  if (Array.isArray(local)) return clone(local)
  if (!isRecord(remote) || !isRecord(local)) return clone(local)
  const result: Record<string, unknown> = { ...clone(remote) as object }
  Object.entries(local).forEach(([key, value]) => {
    result[key] = Object.hasOwn(remote, key)
      ? mergeLegacyValue(remote[key], value)
      : clone(value)
  })
  return result
}

function mergeIdArrays(
  base: Array<{ id: string }>,
  local: Array<{ id: string }>,
  remote: Array<{ id: string }>,
) {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const orderedIds = Array.from(new Set([
    ...remote.map((item) => item.id),
    ...local.map((item) => item.id),
  ]))
  return orderedIds.flatMap((id) => {
    const baseItem = baseById.get(id)
    const localItem = localById.get(id)
    const remoteItem = remoteById.get(id)
    if (!localItem && baseItem) return []
    if (!localItem) return remoteItem ? [clone(remoteItem)] : []
    if (!baseItem) return [clone(localItem)]
    return [mergeValue(baseItem, localItem, remoteItem)]
  })
}

function isPendingEnvelope(value: unknown): value is {
  format: typeof PENDING_PROFILE_SYNC_FORMAT
  version: typeof PENDING_PROFILE_SYNC_VERSION
  state: unknown
  baseState: unknown
  writeToken: string
  queuedAt: string
  attempted?: boolean
} {
  return Boolean(
    isRecord(value) &&
      value.format === PENDING_PROFILE_SYNC_FORMAT &&
      value.version === PENDING_PROFILE_SYNC_VERSION &&
      isRecord(value.state) &&
      (value.baseState === null || isRecord(value.baseState)) &&
      typeof value.writeToken === 'string' &&
      value.writeToken.startsWith('sync-') &&
      typeof value.queuedAt === 'string',
  )
}

function isIdArray(value: unknown): value is Array<{ id: string }> {
  return Array.isArray(value) && value.every(
    (item) => isRecord(item) && typeof item.id === 'string',
  )
}

function earliestDate(first: string | null, second: string | null) {
  if (!first) return second
  if (!second) return first
  return first < second ? first : second
}

function deepEqual(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
