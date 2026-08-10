import type { HanaGameState, Quest } from '@/types'
import { createProfileSyncToken } from '@/lib/profileSync'
import {
  addDays,
  flowersForQuest,
  getQuestCatalog,
  getLongTermDueDate,
  getQuestScheduleProgress,
} from '@/lib/hanaGame'
import {
  isHabitArchivedOnDate,
  isHabitGraduatedOnDate,
  isHabitPausedOnDate,
} from '@/lib/habitLifecycle'

export type HanaProfileId = 'hana' | 'cramble'
export type HanaQuestSyncStatus =
  | 'pending'
  | 'completed'
  | 'skipped'
  | 'paused'

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
  writeToken: string
  syncedAt: string
  currentDate: string
  totalFlowers: number
  state: HanaGameState
  questStatuses: HanaQuestSyncRow[]
  weedStatuses: HanaWeedSyncRow[]
}

export function createProfileCloudSyncPayload(
  profileId: HanaProfileId,
  state: HanaGameState,
  quests: Quest[],
  syncedAt = new Date().toISOString(),
  writeToken = createProfileSyncToken(),
): HanaCloudSyncPayload {
  return {
    profileId,
    writeToken,
    syncedAt,
    currentDate: state.currentDate,
    totalFlowers: state.totalFlowers,
    state,
    questStatuses: createQuestStatusRows(profileId, state, quests),
    weedStatuses: createWeedStatusRows(profileId, state),
  }
}

export function createHanaCloudSyncPayload(
  profileId: HanaProfileId,
  state: HanaGameState,
  quests: Quest[],
  syncedAt = new Date().toISOString(),
  writeToken = createProfileSyncToken(),
): HanaCloudSyncPayload {
  return createProfileCloudSyncPayload(
    profileId,
    state,
    quests,
    syncedAt,
    writeToken,
  )
}

function createQuestStatusRows(
  profileId: HanaProfileId,
  state: HanaGameState,
  quests: Quest[],
) {
  const catalog = getQuestCatalog(quests, state)
  const questById = new Map(catalog.map((quest) => [quest.id, quest]))
  const rows = new Map<string, HanaQuestSyncRow>()

  const setDailyRow = (
    dateKey: string,
    questId: string,
    status: HanaQuestSyncStatus,
  ) => {
    const quest = questById.get(questId)
    if (!quest) {
      return
    }
    const resolvedStatus =
      status === 'pending' &&
      (isHabitPausedOnDate(state, questId, dateKey) ||
        isHabitArchivedOnDate(state, questId, dateKey) ||
        isHabitGraduatedOnDate(state, questId, dateKey))
        ? 'paused'
        : status
    const flowersEarned =
      resolvedStatus === 'completed' ? flowersForQuest(quest) : 0
    const key = makeRowKey(profileId, 'daily', questId, dateKey)

    rows.set(key, {
      profileId,
      questGroup: 'daily',
      questId,
      periodKey: dateKey,
      dateKey,
      windowStart: null,
      dueDate: null,
      status: resolvedStatus,
      flowersEarned,
    })
  }

  const setLongTermRow = (
    questId: string,
    startedAt: string,
    status: HanaQuestSyncStatus,
  ) => {
    const quest = questById.get(questId)
    if (!quest) {
      return
    }
    const dueDate = getLongTermDueDate(startedAt, quest)
    const resolvedStatus =
      status === 'pending' &&
      isWindowNeutral(state, questId, startedAt, dueDate)
        ? 'paused'
        : status
    const flowersEarned =
      resolvedStatus === 'completed' ? flowersForQuest(quest) : 0
    const key = makeRowKey(profileId, 'longTerm', questId, startedAt)

    rows.set(key, {
      profileId,
      questGroup: 'longTerm',
      questId,
      periodKey: startedAt,
      dateKey: null,
      windowStart: startedAt,
      dueDate,
      status: resolvedStatus,
      flowersEarned,
    })
  }

  const flexiblePeriods = new Map<
    string,
    { quest: Quest; representativeDate: string }
  >()
  const trackFlexiblePeriod = (dateKey: string, quest: Quest) => {
    if (quest.createdDate && dateKey < quest.createdDate) {
      return
    }
    const progress = getQuestScheduleProgress(state, quest, dateKey)
    flexiblePeriods.set(`${quest.id}:${progress.periodStart}`, {
      quest,
      representativeDate: dateKey,
    })
  }

  Object.entries(state.activeDailyQuests ?? {}).forEach(([dateKey, questIds]) => {
    questIds.forEach((questId) => {
      const quest = questById.get(questId)
      if (!quest) {
        return
      }
      if (
        quest.schedule?.kind === 'quota' ||
        quest.schedule?.kind === 'periodTarget'
      ) {
        trackFlexiblePeriod(dateKey, quest)
        return
      }
      setDailyRow(dateKey, questId, 'pending')
    })
  })

  Object.entries(state.dailyCompletions ?? {}).forEach(([dateKey, completions]) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      if (isComplete) {
        const quest = questById.get(questId)
        if (!quest) {
          return
        }
        if (quest.schedule?.kind === 'quota') {
          trackFlexiblePeriod(dateKey, quest)
          return
        }
        if (quest.schedule?.kind === 'periodTarget') {
          return
        }
        setDailyRow(dateKey, questId, 'completed')
      }
    })
  })

  Object.entries(state.habitOccurrences ?? {}).forEach(
    ([dateKey, occurrences]) => {
      Object.entries(occurrences).forEach(([questId, count]) => {
        if (count <= 0) {
          return
        }
        const quest = questById.get(questId)
        if (
          quest?.schedule?.kind === 'periodTarget' &&
          (!quest.createdDate || dateKey >= quest.createdDate)
        ) {
          trackFlexiblePeriod(dateKey, quest)
        }
      })
    },
  )

  flexiblePeriods.forEach(({ quest, representativeDate }) => {
    const progress = getQuestScheduleProgress(
      state,
      quest,
      representativeDate,
    )
    const key = makeRowKey(
      profileId,
      'daily',
      quest.id,
      progress.periodStart,
    )
    rows.set(key, {
      profileId,
      questGroup: 'daily',
      questId: quest.id,
      periodKey: progress.periodStart,
      dateKey: null,
      windowStart: progress.periodStart,
      dueDate: progress.periodEnd,
      status: progress.isComplete
        ? 'completed'
        : isWindowNeutral(
            state,
            quest.id,
            progress.periodStart,
            progress.periodEnd,
          )
          ? 'paused'
          : 'pending',
      flowersEarned:
        quest.schedule?.kind === 'periodTarget'
          ? progress.isComplete
            ? flowersForQuest(quest)
            : 0
          : Math.min(progress.completed, progress.target) * flowersForQuest(quest),
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
        const scheduleKind = questById.get(parsedSkip.questId)?.schedule?.kind
        if (scheduleKind === 'quota' || scheduleKind === 'periodTarget') {
          const rowKey = makeRowKey(
            profileId,
            'daily',
            parsedSkip.questId,
            parsedSkip.periodKey,
          )
          const existing = rows.get(rowKey)
          if (existing?.status !== 'completed' && existing) {
            rows.set(rowKey, { ...existing, status: 'skipped', flowersEarned: 0 })
          }
          return
        }
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

function isWindowNeutral(
  state: HanaGameState,
  questId: string,
  startDate: string,
  endDate: string,
) {
  for (
    let dateKey = startDate;
    dateKey <= endDate;
    dateKey = addDays(dateKey, 1)
  ) {
    if (
      isHabitPausedOnDate(state, questId, dateKey) ||
      isHabitArchivedOnDate(state, questId, dateKey) ||
      isHabitGraduatedOnDate(state, questId, dateKey)
    ) {
      return true
    }
  }
  return false
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
