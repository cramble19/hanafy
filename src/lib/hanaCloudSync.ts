import type { HanaGameState, Quest } from '@/types'
import {
  flowersForQuest,
  getLongTermDueDate,
} from '@/lib/hanaGame'

export type HanaProfileId = 'hana' | 'cramble'
export type HanaQuestSyncStatus = 'pending' | 'completed' | 'skipped'

export type HanaQuestSyncRow = {
  profileId: HanaProfileId
  questGroup: Quest['group']
  questId: string
  periodKey: string
  dateKey: string | null
  windowStart: string | null
  dueDate: string | null
  status: HanaQuestSyncStatus
  flowersEarned: number
}

export type HanaWeedSyncRow = {
  profileId: HanaProfileId
  dateKey: string
  weedId: string
  checked: boolean
}

export type HanaCloudSyncPayload = {
  profileId: HanaProfileId
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: HanaGameState
  questStatuses: HanaQuestSyncRow[]
  weedStatuses: HanaWeedSyncRow[]
}

export function createHanaCloudSyncPayload(
  profileId: HanaProfileId,
  state: HanaGameState,
  quests: Quest[],
  syncedAt = new Date().toISOString(),
): HanaCloudSyncPayload {
  return {
    profileId,
    syncedAt,
    currentDate: state.currentDate,
    totalFlowers: state.totalFlowers,
    state,
    questStatuses: createQuestStatusRows(profileId, state, quests),
    weedStatuses: createWeedStatusRows(profileId, state),
  }
}

function createQuestStatusRows(
  profileId: HanaProfileId,
  state: HanaGameState,
  quests: Quest[],
) {
  const questById = new Map(quests.map((quest) => [quest.id, quest]))
  const rows = new Map<string, HanaQuestSyncRow>()

  const setDailyRow = (
    dateKey: string,
    questId: string,
    status: HanaQuestSyncStatus,
  ) => {
    const quest = questById.get(questId)
    const flowersEarned = status === 'completed' && quest ? flowersForQuest(quest) : 0
    const key = makeRowKey(profileId, 'daily', questId, dateKey)

    rows.set(key, {
      profileId,
      questGroup: 'daily',
      questId,
      periodKey: dateKey,
      dateKey,
      windowStart: null,
      dueDate: null,
      status,
      flowersEarned,
    })
  }

  const setLongTermRow = (
    questId: string,
    startedAt: string,
    status: HanaQuestSyncStatus,
  ) => {
    const quest = questById.get(questId)
    const flowersEarned = status === 'completed' && quest ? flowersForQuest(quest) : 0
    const key = makeRowKey(profileId, 'longTerm', questId, startedAt)

    rows.set(key, {
      profileId,
      questGroup: 'longTerm',
      questId,
      periodKey: startedAt,
      dateKey: null,
      windowStart: startedAt,
      dueDate: quest ? getLongTermDueDate(startedAt, quest) : null,
      status,
      flowersEarned,
    })
  }

  Object.entries(state.activeDailyQuests ?? {}).forEach(([dateKey, questIds]) => {
    questIds.forEach((questId) => setDailyRow(dateKey, questId, 'pending'))
  })

  Object.entries(state.dailyCompletions ?? {}).forEach(([dateKey, completions]) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      if (isComplete) {
        setDailyRow(dateKey, questId, 'completed')
      }
    })
  })

  Object.entries(state.longTermWindows ?? {}).forEach(([questId, startedAt]) => {
    setLongTermRow(questId, startedAt, 'pending')
  })

  Object.entries(state.longTermCompletions ?? {}).forEach(
    ([questId, completions]) => {
      Object.entries(completions).forEach(([startedAt, isComplete]) => {
        if (isComplete) {
          setLongTermRow(questId, startedAt, 'completed')
        }
      })
    },
  )

  Object.values(state.questSkips ?? {}).forEach((skips) => {
    Object.entries(skips).forEach(([skipKey, isSkipped]) => {
      if (!isSkipped) {
        return
      }

      const parsedSkip = parseSkipKey(skipKey)
      if (!parsedSkip) {
        return
      }

      if (parsedSkip.group === 'daily') {
        const rowKey = makeRowKey(
          profileId,
          'daily',
          parsedSkip.questId,
          parsedSkip.periodKey,
        )
        const existing = rows.get(rowKey)
        if (existing?.status !== 'completed') {
          setDailyRow(parsedSkip.periodKey, parsedSkip.questId, 'skipped')
        }
        return
      }

      const rowKey = makeRowKey(
        profileId,
        'longTerm',
        parsedSkip.questId,
        parsedSkip.periodKey,
      )
      const existing = rows.get(rowKey)
      if (existing?.status !== 'completed') {
        setLongTermRow(parsedSkip.questId, parsedSkip.periodKey, 'skipped')
      }
    })
  })

  state.activeLongTermQuestIds.forEach((questId) => {
    const startedAt = state.longTermWindows[questId] ?? state.currentDate
    const rowKey = makeRowKey(profileId, 'longTerm', questId, startedAt)
    if (!rows.has(rowKey)) {
      setLongTermRow(questId, startedAt, 'pending')
    }
  })

  return Array.from(rows.values()).sort(sortQuestRows)
}

function createWeedStatusRows(profileId: HanaProfileId, state: HanaGameState) {
  return Object.entries(state.eveningWeeds ?? {})
    .flatMap(([dateKey, weeds]) =>
      Object.entries(weeds).map(([weedId, checked]) => ({
        profileId,
        dateKey,
        weedId,
        checked,
      })),
    )
    .sort((first, second) =>
      `${first.dateKey}:${first.weedId}`.localeCompare(
        `${second.dateKey}:${second.weedId}`,
      ),
    )
}

function parseSkipKey(skipKey: string) {
  const [group, questId, periodKey] = skipKey.split(':')
  if (
    (group !== 'daily' && group !== 'longTerm') ||
    !questId ||
    !periodKey
  ) {
    return null
  }

  return { group, questId, periodKey }
}

function makeRowKey(
  profileId: HanaProfileId,
  questGroup: Quest['group'],
  questId: string,
  periodKey: string,
) {
  return `${profileId}:${questGroup}:${questId}:${periodKey}`
}

function sortQuestRows(first: HanaQuestSyncRow, second: HanaQuestSyncRow) {
  return `${first.periodKey}:${first.questGroup}:${first.questId}`.localeCompare(
    `${second.periodKey}:${second.questGroup}:${second.questId}`,
  )
}
