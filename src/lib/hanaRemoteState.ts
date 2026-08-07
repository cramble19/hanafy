import { quests as hanaQuests } from '@/data/quests'
import {
  createProfileCloudSyncPayload,
  type HanaProfileId,
} from '@/lib/hanaCloudSync'
import { hasHanaStarted } from '@/lib/hanaGame'
import type { HanaGameState, Quest } from '@/types'

type FetchLike = typeof fetch

export type RemoteHanaSnapshot = {
  profileId: HanaProfileId
  currentDate: string
  totalFlowers: number
  state: unknown
  syncedAt: string
  revision?: number
}

export type LoadHanaStateResult =
  | { ok: true; snapshot: RemoteHanaSnapshot | null }
  | { ok: false; error: string }

export type SaveHanaStateResult =
  | { ok: true; syncedAt: string; revision: number }
  | { ok: false; error: string; conflict?: boolean }

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
    const snapshot = parseSnapshotResponse(body, profileId)
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
  return saveProfileStateToDb(state, profileId, hanaQuests, fetchImpl)
}

export async function saveProfileStateToDb(
  state: HanaGameState,
  profileId: HanaProfileId,
  questCatalog: Quest[],
  fetchImpl: FetchLike = fetch,
): Promise<SaveHanaStateResult> {
  if (!hasHanaStarted(state)) {
    return {
      ok: false,
      error:
        profileId === 'hana'
          ? 'Cannot save Hana before health overhaul is started'
          : 'Cannot save Cramble before the chronicle is started',
    }
  }

  const payload = createProfileCloudSyncPayload(profileId, state, questCatalog)
  const baseRevision = state.syncRevision ?? 0

  try {
    const response = await fetchImpl('/api/hana-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, baseRevision }),
    })

    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 409
            ? 'This profile changed on another device. Reload before saving again.'
            : `Save failed with ${response.status}`,
        conflict: response.status === 409,
      }
    }

    const body = (await response.json()) as unknown
    const revision =
      isRecord(body) &&
      Number.isInteger(body.revision) &&
      (body.revision as number) > baseRevision
        ? (body.revision as number)
        : baseRevision + 1
    return { ok: true, syncedAt: payload.syncedAt, revision }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Save failed',
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

function parseSnapshotResponse(
  value: unknown,
  expectedProfileId: HanaProfileId,
): RemoteHanaSnapshot | null | undefined {
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
    snapshot.profileId !== expectedProfileId ||
    typeof snapshot.currentDate !== 'string' ||
    typeof snapshot.totalFlowers !== 'number' ||
    typeof snapshot.syncedAt !== 'string' ||
    !isRecord(snapshot.state)
  ) {
    return undefined
  }

  const parsed = {
    profileId: expectedProfileId,
    currentDate: snapshot.currentDate,
    totalFlowers: snapshot.totalFlowers,
    state: snapshot.state,
    syncedAt: snapshot.syncedAt,
  }
  return Number.isInteger(snapshot.revision) &&
    (snapshot.revision as number) >= 1
    ? { ...parsed, revision: snapshot.revision as number }
    : parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
