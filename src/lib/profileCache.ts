import { crambleQuests } from '@/data/crambleQuests'
import { quests as hanaQuests } from '@/data/quests'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import {
  hasHanaStarted,
  parseStoredHanaState,
  STORAGE_KEY,
  todayKey,
} from '@/lib/hanaGame'
import {
  parsePendingProfileSync,
  type PendingProfileSync,
} from '@/lib/profileSync'
import type { DailyEmotion, HanaGameState, Quest } from '@/types'

export const HANA_PENDING_STORAGE_KEY = 'hana-game/pending-v1'

export type LocalProfileId = 'hana' | 'cramble'
export type LocalProfileSource = 'pending' | 'cache'

export type LocalProfileState = {
  state: HanaGameState
  pending: PendingProfileSync | null
  source: LocalProfileSource
}

type StorageReader = Pick<Storage, 'getItem'>

export function readLocalProfileState(
  profileId: LocalProfileId,
  dateKey = todayKey(),
  storage: StorageReader | null = getBrowserStorage(),
): LocalProfileState | null {
  if (!storage) return null

  const config = getProfileCacheConfig(profileId)
  const parseState = (raw: string) =>
    parseStoredHanaState(raw, config.quests, dateKey, config.planOptions)

  try {
    const pending = parsePendingProfileSync(
      storage.getItem(config.pendingKey),
      parseState,
    )
    if (pending && hasHanaStarted(pending.state)) {
      return { state: pending.state, pending, source: 'pending' }
    }

    const cachedRaw = storage.getItem(config.storageKey)
    if (!cachedRaw) return null
    const cached = parseState(cachedRaw)
    return hasHanaStarted(cached)
      ? { state: cached, pending: null, source: 'cache' }
      : null
  } catch {
    return null
  }
}

export function readLocalProfileEmotion(
  profileId: LocalProfileId,
  dateKey = todayKey(),
  storage: StorageReader | null = getBrowserStorage(),
): DailyEmotion | null {
  return (
    readLocalProfileState(profileId, dateKey, storage)?.state.dailyEmotions[
      dateKey
    ] ?? null
  )
}

function getProfileCacheConfig(profileId: LocalProfileId): {
  storageKey: string
  pendingKey: string
  quests: Quest[]
  planOptions: Parameters<typeof parseStoredHanaState>[3]
} {
  return profileId === 'hana'
    ? {
        storageKey: STORAGE_KEY,
        pendingKey: HANA_PENDING_STORAGE_KEY,
        quests: hanaQuests,
        planOptions: {},
      }
    : {
        storageKey: CRAMBLE_STORAGE_KEY,
        pendingKey: CRAMBLE_PENDING_STORAGE_KEY,
        quests: crambleQuests,
        planOptions: CRAMBLE_QUEST_PLAN_OPTIONS,
      }
}

function getBrowserStorage(): StorageReader | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
