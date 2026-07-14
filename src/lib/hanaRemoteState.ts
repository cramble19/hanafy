import { quests } from '@/data/quests'
import {
  createHanaCloudSyncPayload,
  type HanaProfileId,
} from '@/lib/hanaCloudSync'
import { hasHanaStarted } from '@/lib/hanaGame'
import type { HanaGameState } from '@/types'

type FetchLike = typeof fetch

export type RemoteHanaSnapshot = {
  profileId: HanaProfileId
  currentDate: string
  totalFlowers: number
  state: unknown
  syncedAt: string
}

export type LoadHanaStateResult =
  | { ok: true; snapshot: RemoteHanaSnapshot | null }
  | { ok: false; error: string }

export type SaveHanaStateResult =
  | { ok: true; syncedAt: string }
  | { ok: false; error: string }

export type ClearHanaStateResult = { ok: true } | { ok: false; error: string }

export type DbFirstStateSource = 'database' | 'cache' | 'initial'

export async function loadHanaStateFromDb(
  profileId: HanaProfileId = 'hana',
  fetchImpl: FetchLike = fetch,
): Promise<LoadHanaStateResult> {
  try {
    const response = await fetchImpl(`/api/hana-sync?profileId=${profileId}`)
    if (!response.ok) {
      return { ok: false, error: `Load failed with ${response.status}` }
    }

    const body = (await response.json()) as unknown
    const snapshot = parseSnapshotResponse(body)
    if (snapshot === undefined) {
      return { ok: false, error: 'Invalid DB snapshot response' }
    }

    return { ok: true, snapshot }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Load failed',
    }
  }
}

export async function saveHanaStateToDb(
  state: HanaGameState,
  profileId: HanaProfileId = 'hana',
  fetchImpl: FetchLike = fetch,
): Promise<SaveHanaStateResult> {
  if (!hasHanaStarted(state)) {
    return { ok: false, error: 'Cannot save Hana before health overhaul is started' }
  }

  const payload = createHanaCloudSyncPayload(profileId, state, quests)

  try {
    const response = await fetchImpl('/api/hana-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { ok: false, error: `Save failed with ${response.status}` }
    }

    return { ok: true, syncedAt: payload.syncedAt }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Save failed',
    }
  }
}

export async function clearHanaStateFromDb(
  profileId: HanaProfileId = 'hana',
  fetchImpl: FetchLike = fetch,
): Promise<ClearHanaStateResult> {
  try {
    const response = await fetchImpl(`/api/hana-sync?profileId=${profileId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      return { ok: false, error: `Clear failed with ${response.status}` }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Clear failed',
    }
  }
}


export function chooseDbFirstState({
  databaseState,
  cachedState,
  initialState,
}: {
  databaseState: HanaGameState | null
  cachedState: HanaGameState | null
  initialState: HanaGameState
}): { state: HanaGameState; source: DbFirstStateSource } {
  if (databaseState) {
    return { state: databaseState, source: 'database' }
  }

  if (cachedState) {
    return { state: cachedState, source: 'cache' }
  }

  return { state: initialState, source: 'initial' }
}

function parseSnapshotResponse(value: unknown): RemoteHanaSnapshot | null | undefined {
  if (!isRecord(value) || value.ok !== true) {
    return undefined
  }

  if (value.snapshot === null) {
    return null
  }

  if (!isRecord(value.snapshot)) {
    return undefined
  }

  const snapshot = value.snapshot
  if (
    (snapshot.profileId !== 'hana' && snapshot.profileId !== 'cramble') ||
    typeof snapshot.currentDate !== 'string' ||
    typeof snapshot.totalFlowers !== 'number' ||
    typeof snapshot.syncedAt !== 'string' ||
    !isRecord(snapshot.state)
  ) {
    return undefined
  }

  return {
    profileId: snapshot.profileId,
    currentDate: snapshot.currentDate,
    totalFlowers: snapshot.totalFlowers,
    state: snapshot.state,
    syncedAt: snapshot.syncedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
