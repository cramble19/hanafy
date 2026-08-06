import type {
  CustomHabitQuest,
  Difficulty,
  HanaGameState,
  Quest,
  QuestSchedule,
  Weekday,
} from '@/types'

export const FLOWERS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

const LEVEL_REQUIREMENTS = [0, 5, 12, 22, 35, 52, 74, 100]
const WEEDS_PER_WILTED_FLOWER = 3
const SPRING_MEMORY_QUEST_ID = 'remember-cramble'
export const WEEKLY_SKIP_LIMIT = 3
export const PERIOD_TARGET_LIMITS = {
  target: 100,
  periodDays: 365,
} as const
export const SPRING_ARC = {
  arcNumber: 1,
  season: 'Spring',
  targetLevel: 5,
  targetFlowers: 35,
  nextSeason: 'Summer',
  nextTheme: 'Consistency & tough choices',
} as const

export const STORAGE_KEY = 'hana-game/v1'

export type QuestPlanOptions = {
  /** Replace expired long-term quests with the next eligible catalog entries. */
  rotateExpiredLongTerm?: boolean
}

export type QuestScheduleProgress = {
  kind: QuestSchedule['kind']
  label: string | null
  periodStart: string
  periodEnd: string
  completed: number
  completedToday: number
  target: number
  remaining: number
  isComplete: boolean
  isScheduledToday: boolean
}

export function todayKey(date = new Date()) {
  return formatDateKey(date)
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

export function displayDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function createInitialHanaState(): HanaGameState {
  return {
    startDate: null,
    currentDate: todayKey(),
    customHabits: [],
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    habitOccurrences: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
  }
}

export function createStartedHanaState(startDate: string): HanaGameState {
  return {
    ...createInitialHanaState(),
    startDate,
    currentDate: startDate,
  }
}

export function resetProfileProgress(
  state: HanaGameState,
  quests: Quest[],
  options: QuestPlanOptions = {},
) {
  return syncActiveQuestPlan(
    {
      ...createInitialHanaState(),
      startDate: state.startDate,
      currentDate: state.currentDate,
      customHabits: [...(state.customHabits ?? [])],
    },
    quests,
    options,
  )
}

export function hasHanaStarted(state: HanaGameState | null | undefined) {
  return typeof state?.startDate === 'string' && state.startDate.length > 0
}

export function getQuestCatalog(baseQuests: Quest[], state: HanaGameState) {
  const catalog: Quest[] = []
  const seenIds = new Set<string>()

  baseQuests.forEach((quest) => {
    if (!seenIds.has(quest.id)) {
      seenIds.add(quest.id)
      catalog.push(quest)
    }
  })
  const customHabits = state.customHabits ?? []
  customHabits.forEach((quest) => {
    if (
      quest.custom === true &&
      !seenIds.has(quest.id) &&
      hasValidCustomHabitSchedule(quest)
    ) {
      seenIds.add(quest.id)
      catalog.push(quest)
    }
  })

  return catalog
}

export function toggleQuestCompletion(
  state: HanaGameState,
  quest: Quest,
): HanaGameState {
  if (quest.group === 'longTerm') {
    const startedAt = state.longTermWindows[quest.id] ?? state.currentDate
    const questCompletions = state.longTermCompletions[quest.id] ?? {}
    return {
      ...state,
      longTermWindows: {
        ...state.longTermWindows,
        [quest.id]: startedAt,
      },
      longTermCompletions: {
        ...state.longTermCompletions,
        [quest.id]: {
          ...questCompletions,
          [startedAt]: !questCompletions[startedAt],
        },
      },
    }
  }

  if (quest.schedule?.kind === 'periodTarget') {
    const progress = getQuestScheduleProgress(state, quest)
    if (progress.isComplete) {
      return state
    }

    const occurrencesForDate = state.habitOccurrences?.[state.currentDate] ?? {}
    return {
      ...state,
      habitOccurrences: {
        ...(state.habitOccurrences ?? {}),
        [state.currentDate]: {
          ...occurrencesForDate,
          [quest.id]: (occurrencesForDate[quest.id] ?? 0) + 1,
        },
      },
    }
  }

  const completions = state.dailyCompletions[state.currentDate] ?? {}
  return {
    ...state,
    dailyCompletions: {
      ...state.dailyCompletions,
      [state.currentDate]: {
        ...completions,
        [quest.id]: !completions[quest.id],
      },
    },
  }
}

export function undoQuestCompletion(
  state: HanaGameState,
  quest: Quest,
): HanaGameState {
  if (quest.schedule?.kind !== 'periodTarget') {
    return state
  }

  const occurrencesForDate = state.habitOccurrences?.[state.currentDate] ?? {}
  const currentCount = occurrencesForDate[quest.id] ?? 0
  if (currentCount <= 0) {
    return state
  }

  return {
    ...state,
    habitOccurrences: {
      ...(state.habitOccurrences ?? {}),
      [state.currentDate]: {
        ...occurrencesForDate,
        [quest.id]: currentCount - 1,
      },
    },
  }
}

export function getCompletionsForQuestGroup(
  state: HanaGameState,
  group: Quest['group'],
) {
  if (group === 'longTerm') {
    return getLongTermCheckedIds(state)
  }

  return state.dailyCompletions[state.currentDate] ?? {}
}

export function syncActiveQuestPlan(
  state: HanaGameState,
  quests: Quest[],
  options: QuestPlanOptions = {},
) {
  const catalog = getQuestCatalog(quests, state)
  const level = getLevel(state.totalFlowers)
  const dailyIds = selectDailyQuestIds(catalog, state, level)
  const activeDailyQuests = state.activeDailyQuests ?? {}
  const activeLongTermQuestIds = state.activeLongTermQuestIds ?? []
  const existingDailyIds = activeDailyQuests[state.currentDate] ?? []
  const validExistingDailyIds = existingDailyIds.filter((questId) =>
    dailyIds.includes(questId),
  )
  const nextDailyIds = fillIds(validExistingDailyIds, dailyIds, dailyIds.length)

  const longTermIds = selectLongTermQuestIds(catalog, level)
  const expiredLongTermIds = options.rotateExpiredLongTerm
    ? activeLongTermQuestIds.filter((questId) => {
        const quest = catalog.find((item) => item.id === questId)
        const windowStart = state.longTermWindows[questId]
        return Boolean(
          quest &&
            windowStart &&
            isAfterLongTermDeadline(state.currentDate, windowStart, quest),
        )
      })
    : []
  const validExistingLongTermIds = activeLongTermQuestIds.filter(
    (questId) =>
      longTermIds.includes(questId) && !expiredLongTermIds.includes(questId),
  )
  const orderedLongTermIds = expiredLongTermIds.length
    ? rotateIdsAfter(longTermIds, expiredLongTermIds)
    : longTermIds
  const nextLongTermIds = fillIds(
    validExistingLongTermIds,
    orderedLongTermIds,
    longTermQuestCount(level),
  )

  const nextWindows = { ...state.longTermWindows }
  nextLongTermIds.forEach((questId) => {
    const quest = catalog.find((item) => item.id === questId)
    if (!quest) {
      return
    }

    const currentStart = nextWindows[questId]
    if (
      !currentStart ||
      isAfterLongTermDeadline(state.currentDate, currentStart, quest)
    ) {
      nextWindows[questId] = state.currentDate
    }
  })

  return {
    ...state,
    activeDailyQuests: {
      ...activeDailyQuests,
      [state.currentDate]: nextDailyIds,
    },
    activeLongTermQuestIds: nextLongTermIds,
    longTermWindows: nextWindows,
  }
}

export function syncStateToDate(
  state: HanaGameState,
  quests: Quest[],
  dateKey = todayKey(),
  options: QuestPlanOptions = {},
) {
  return syncActiveQuestPlan(
    {
      ...state,
      currentDate: dateKey,
      totalFlowers: recomputeTotalFlowers(state, quests),
    },
    quests,
    options,
  )
}

export function parseStoredHanaState(
  raw: string | null,
  quests: Quest[],
  dateKey = todayKey(),
  options: QuestPlanOptions = {},
) {
  if (!raw) {
    return syncStateToDate(createInitialHanaState(), quests, dateKey, options)
  }

  try {
    return syncStateToDate(
      normalizeHanaState(JSON.parse(raw) as unknown, quests, options),
      quests,
      dateKey,
      options,
    )
  } catch {
    return syncStateToDate(createInitialHanaState(), quests, dateKey, options)
  }
}

export function recomputeTotalFlowers(state: HanaGameState, quests: Quest[]) {
  const catalog = getQuestCatalog(quests, state)
  const questById = new Map(catalog.map((quest) => [quest.id, quest]))
  const quotaCompletions = new Map<
    string,
    { quest: Quest; completed: number }
  >()
  let earnedFlowers = 0

  Object.entries(state.dailyCompletions).forEach(([dateKey, completions]) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      const quest = questById.get(questId)
      if (!isComplete || !quest) {
        return
      }

      if (
        quest.schedule?.kind !== 'quota' &&
        quest.schedule?.kind !== 'periodTarget'
      ) {
        earnedFlowers += flowersForQuest(quest)
        return
      }

      if (quest.schedule.kind === 'periodTarget') {
        return
      }

      const periodStart = getQuestScheduleProgress(
        state,
        quest,
        dateKey,
      ).periodStart
      const key = `${quest.id}:${periodStart}`
      const period = quotaCompletions.get(key) ?? { quest, completed: 0 }
      period.completed += 1
      quotaCompletions.set(key, period)
    })
  })

  quotaCompletions.forEach(({ quest, completed }) => {
    const schedule = quest.schedule
    if (schedule?.kind === 'quota') {
      earnedFlowers +=
        Math.min(completed, schedule.target) * flowersForQuest(quest)
    }
  })

  const periodTargetCompletions = new Map<
    string,
    { quest: Quest; completed: number }
  >()
  Object.entries(state.habitOccurrences ?? {}).forEach(
    ([dateKey, occurrences]) => {
      Object.entries(occurrences).forEach(([questId, count]) => {
        const quest = questById.get(questId)
        if (
          !quest ||
          quest.schedule?.kind !== 'periodTarget' ||
          (quest.createdDate && dateKey < quest.createdDate) ||
          !Number.isInteger(count) ||
          count <= 0
        ) {
          return
        }

        const periodStart = getQuestScheduleProgress(
          state,
          quest,
          dateKey,
        ).periodStart
        const key = `${quest.id}:${periodStart}`
        const period = periodTargetCompletions.get(key) ?? {
          quest,
          completed: 0,
        }
        period.completed += count
        periodTargetCompletions.set(key, period)
      })
    },
  )

  periodTargetCompletions.forEach(({ quest, completed }) => {
    const schedule = quest.schedule
    if (schedule?.kind === 'periodTarget' && completed >= schedule.target) {
      earnedFlowers += flowersForQuest(quest)
    }
  })

  Object.values(state.longTermCompletions).forEach((completions) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      const quest = questById.get(questId)
      if (isComplete && quest) {
        earnedFlowers += flowersForQuest(quest)
      }
    })
  })

  return Math.max(0, earnedFlowers - getWiltedFlowerCount(state))
}

export function getEveningWeedCount(state: HanaGameState) {
  return Object.values(state.eveningWeeds ?? {}).reduce(
    (total, weedsForDay) =>
      total + Object.values(weedsForDay).filter(Boolean).length,
    0,
  )
}

export function getWiltedFlowerCount(state: HanaGameState) {
  return Math.floor(getEveningWeedCount(state) / WEEDS_PER_WILTED_FLOWER)
}

export function getWeedProgress(state: HanaGameState) {
  const weedCount = getEveningWeedCount(state)
  return {
    weedCount,
    wiltedFlowers: Math.floor(weedCount / WEEDS_PER_WILTED_FLOWER),
    weedsTowardNextWilt: weedCount % WEEDS_PER_WILTED_FLOWER,
    weedsPerWiltedFlower: WEEDS_PER_WILTED_FLOWER,
  }
}

export function flowersForQuest(quest: Quest) {
  return FLOWERS_BY_DIFFICULTY[quest.difficulty]
}

export function getLevel(totalFlowers: number) {
  let level = 1
  while (totalFlowers >= flowersRequiredForLevel(level + 1)) {
    level += 1
  }
  return level
}

export function getLevelProgress(totalFlowers: number) {
  const level = getLevel(totalFlowers)
  const currentFloor = flowersRequiredForLevel(level)
  const nextTarget = flowersRequiredForLevel(level + 1)
  const collectedThisLevel = totalFlowers - currentFloor
  const neededThisLevel = nextTarget - currentFloor

  return {
    level,
    currentFloor,
    nextTarget,
    collectedThisLevel,
    neededThisLevel,
    percent: Math.min(100, Math.round((collectedThisLevel / neededThisLevel) * 100)),
  }
}

export function getSpringArcProgress(state: HanaGameState) {
  const level = getLevel(state.totalFlowers)
  const flowerPercent = Math.min(
    100,
    Math.round((state.totalFlowers / SPRING_ARC.targetFlowers) * 100),
  )
  const levelPercent = Math.min(
    100,
    Math.round((level / SPRING_ARC.targetLevel) * 100),
  )
  const percent = Math.min(flowerPercent, levelPercent)

  return {
    ...SPRING_ARC,
    level,
    percent,
    flowerPercent,
    levelPercent,
    flowersRemaining: Math.max(0, SPRING_ARC.targetFlowers - state.totalFlowers),
    levelsRemaining: Math.max(0, SPRING_ARC.targetLevel - level),
    isComplete:
      level >= SPRING_ARC.targetLevel &&
      state.totalFlowers >= SPRING_ARC.targetFlowers,
  }
}

export function visibleQuestsForState(quests: Quest[], state: HanaGameState) {
  const catalog = getQuestCatalog(quests, state)
  const dailyQuestIds = state.activeDailyQuests?.[state.currentDate] ?? []
  const longTermQuestIds = state.activeLongTermQuestIds ?? []

  return {
    daily: idsToQuests(catalog, dailyQuestIds),
    longTerm: idsToQuests(catalog, longTermQuestIds),
  }
}

export function getSkipWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey)
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - date.getDay())
  return formatDateKey(sunday)
}

export function hasValidQuestSchedule(quest: Quest) {
  const schedule = quest.schedule
  if (!schedule) {
    return true
  }
  if (quest.group !== 'daily') {
    return false
  }
  if (schedule.kind === 'daily') {
    return true
  }
  if (schedule.kind === 'weekly') {
    return (
      schedule.daysOfWeek.length > 0 &&
      new Set(schedule.daysOfWeek).size === schedule.daysOfWeek.length &&
      schedule.daysOfWeek.every(
        (weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6,
      )
    )
  }

  if (schedule.kind === 'periodTarget') {
    return (
      Number.isInteger(schedule.target) &&
      Number.isInteger(schedule.periodDays) &&
      schedule.target >= 1 &&
      schedule.target <= PERIOD_TARGET_LIMITS.target &&
      schedule.periodDays >= 1 &&
      schedule.periodDays <= PERIOD_TARGET_LIMITS.periodDays &&
      (schedule.anchor !== 'calendarWeek' || schedule.periodDays === 7) &&
      (schedule.anchor !== 'questStart' || isDateKey(quest.createdDate))
    )
  }

  if (schedule.kind !== 'quota') {
    return false
  }

  return (
    Number.isInteger(schedule.target) &&
    Number.isInteger(schedule.periodDays) &&
    schedule.target >= 1 &&
    schedule.target <= schedule.periodDays &&
    schedule.periodDays >= 1 &&
    (schedule.anchor !== 'calendarWeek' || schedule.periodDays === 7) &&
    (schedule.anchor !== 'questStart' || isDateKey(quest.createdDate))
  )
}

export function hasValidCustomHabitSchedule(quest: Quest) {
  if (
    quest.custom !== true ||
    quest.group !== 'daily' ||
    !isDateKey(quest.createdDate) ||
    !hasValidQuestSchedule(quest)
  ) {
    return false
  }

  const schedule = quest.schedule
  if (!schedule) {
    return false
  }
  if (schedule.kind === 'daily') {
    return true
  }
  if (schedule.kind === 'periodTarget') {
    return true
  }
  if (schedule.kind !== 'quota') {
    return false
  }
  return (
    (schedule.anchor === 'calendarWeek' && schedule.periodDays === 7) ||
    (schedule.anchor === 'questStart' && schedule.periodDays === 10)
  )
}

export function getQuestScheduleProgress(
  state: HanaGameState,
  quest: Quest,
  dateKey = state.currentDate,
): QuestScheduleProgress {
  const schedule = quest.schedule ?? { kind: 'daily' as const }
  const completedToday = Boolean(state.dailyCompletions[dateKey]?.[quest.id])

  if (schedule.kind === 'daily') {
    return {
      kind: schedule.kind,
      label: null,
      periodStart: dateKey,
      periodEnd: dateKey,
      completed: completedToday ? 1 : 0,
      completedToday: completedToday ? 1 : 0,
      target: 1,
      remaining: completedToday ? 0 : 1,
      isComplete: completedToday,
      isScheduledToday: true,
    }
  }

  if (schedule.kind === 'weekly') {
    const scheduledToday = schedule.daysOfWeek.includes(
      parseDateKey(dateKey).getDay() as Weekday,
    )
    return {
      kind: schedule.kind,
      label: formatWeekdaySchedule(schedule.daysOfWeek),
      periodStart: dateKey,
      periodEnd: dateKey,
      completed: completedToday ? 1 : 0,
      completedToday: completedToday ? 1 : 0,
      target: 1,
      remaining: completedToday ? 0 : 1,
      isComplete: completedToday,
      isScheduledToday: scheduledToday,
    }
  }

  const target = Math.max(1, Math.floor(schedule.target))
  const periodDays = Math.max(1, Math.floor(schedule.periodDays))
  const periodStart = getFlexiblePeriodStart(
    state,
    quest,
    dateKey,
    periodDays,
    schedule.anchor,
  )
  const periodEnd = addDays(periodStart, periodDays - 1)
  const completedTodayCount =
    schedule.kind === 'periodTarget'
      ? Math.max(0, state.habitOccurrences?.[dateKey]?.[quest.id] ?? 0)
      : completedToday
        ? 1
        : 0
  const completed =
    schedule.kind === 'periodTarget'
      ? countQuestOccurrencesInPeriod(
          state,
          quest.id,
          periodStart,
          periodEnd,
        )
      : countQuestCompletionsInPeriod(
          state,
          quest.id,
          periodStart,
          periodEnd,
        )
  const remaining = Math.max(0, target - completed)
  const isComplete = remaining === 0

  return {
    kind: schedule.kind,
    label:
      periodDays === 1
        ? `${completed} of ${target} today`
        : schedule.anchor === 'calendarWeek' && periodDays === 7
        ? `${completed} of ${target} this week`
        : `${completed} of ${target} in ${periodDays} ${periodDays === 1 ? 'day' : 'days'}`,
    periodStart,
    periodEnd,
    completed,
    completedToday: completedTodayCount,
    target,
    remaining,
    isComplete,
    // Keep the final completion visible on the day it is checked so it can
    // still be undone. Future days stay clear until the next flexible period.
    isScheduledToday: !isComplete || completedTodayCount > 0,
  }
}

export function isQuestScheduledForDate(
  state: HanaGameState,
  quest: Quest,
  dateKey = state.currentDate,
) {
  return (
    (!quest.createdDate || quest.createdDate <= dateKey) &&
    hasValidQuestSchedule(quest) &&
    getQuestScheduleProgress(state, quest, dateKey).isScheduledToday
  )
}

export function getSkipEventKey(state: HanaGameState, quest: Quest) {
  if (quest.group === 'longTerm') {
    return `longTerm:${quest.id}:${state.longTermWindows[quest.id] ?? state.currentDate}`
  }

  return `daily:${quest.id}:${state.currentDate}`
}

export function getSkipProgress(state: HanaGameState) {
  const weekKey = getSkipWeekKey(state.currentDate)
  const used = Object.values(state.questSkips?.[weekKey] ?? {}).filter(Boolean).length

  return {
    weekKey,
    used,
    limit: WEEKLY_SKIP_LIMIT,
    remaining: Math.max(0, WEEKLY_SKIP_LIMIT - used),
  }
}

export function getSkippedIdsForState(quests: Quest[], state: HanaGameState) {
  const weekKey = getSkipWeekKey(state.currentDate)
  const skipsThisWeek = state.questSkips?.[weekKey] ?? {}

  return visibleQuestsForState(quests, state)
    .daily.concat(visibleQuestsForState(quests, state).longTerm)
    .reduce<Record<string, boolean>>((result, quest) => {
      result[quest.id] =
        quest.schedule?.kind === 'quota' ||
        quest.schedule?.kind === 'periodTarget'
          ? false
          : Boolean(skipsThisWeek[getSkipEventKey(state, quest)])
      return result
    }, {})
}

export function getLongTermQuestStatus(state: HanaGameState, quest: Quest) {
  const startedAt = state.longTermWindows[quest.id] ?? state.currentDate
  const dueDate = getLongTermDueDate(startedAt, quest)
  const daysLeft = Math.max(0, dateDiffDays(state.currentDate, dueDate) + 1)
  const isComplete = Boolean(state.longTermCompletions[quest.id]?.[startedAt])

  return {
    startedAt,
    dueDate,
    daysLeft,
    isComplete,
    label: isComplete
      ? `Done · renews after ${displayShortDate(dueDate)}`
      : daysLeft <= 1
        ? 'Due today'
        : `${daysLeft} days left`,
  }
}

export function getLongTermCheckedIds(state: HanaGameState) {
  return Object.entries(state.longTermWindows).reduce<Record<string, boolean>>(
    (result, [questId, startedAt]) => {
      result[questId] = Boolean(state.longTermCompletions[questId]?.[startedAt])
      return result
    },
    {},
  )
}

export function getLongTermDueDate(startedAt: string, quest: Quest) {
  return addDays(startedAt, getQuestDurationDays(quest) - 1)
}

export function getQuestDurationDays(quest: Quest) {
  return quest.durationDays ?? 7
}

function dailyQuestCount(level: number) {
  if (level >= 8) {
    return 5
  }
  if (level >= 5) {
    return 4
  }
  if (level >= 2) {
    return 3
  }
  return 2
}

function longTermQuestCount(level: number) {
  if (level >= 6) {
    return 3
  }
  if (level >= 3) {
    return 2
  }
  return 1
}

function selectDailyQuestIds(
  quests: Quest[],
  state: HanaGameState,
  level: number,
) {
  const unlockedDailyQuests = quests.filter(
    (quest) =>
      quest.group === 'daily' &&
      (quest.minLevel ?? 1) <= level &&
      isQuestScheduledForDate(state, quest),
  )
  const springMemoryQuestIds = unlockedDailyQuests
    .filter((quest) => quest.id === SPRING_MEMORY_QUEST_ID)
    .map((quest) => quest.id)
  const regularDailyQuests = unlockedDailyQuests.filter(
    (quest) => quest.id !== SPRING_MEMORY_QUEST_ID,
  )
  const requiredQuestIds = regularDailyQuests
    .filter((quest) => quest.required)
    .map((quest) => quest.id)
  const optionalQuestIds = regularDailyQuests
    .filter((quest) => !quest.required)
    .map((quest) => quest.id)
  const limit = dailyQuestCount(level)
  const optionalSlots = Math.max(0, limit - requiredQuestIds.length)

  return [
    ...springMemoryQuestIds,
    ...requiredQuestIds,
    ...pickRotating(optionalQuestIds, state.currentDate, optionalSlots),
  ]
}

function selectLongTermQuestIds(quests: Quest[], level: number) {
  return quests
    .filter(
      (quest) => quest.group === 'longTerm' && (quest.minLevel ?? 1) <= level,
    )
    .map((quest) => quest.id)
}

function fillIds(existingIds: string[], candidateIds: string[], limit: number) {
  const nextIds = [...existingIds]
  candidateIds.forEach((questId) => {
    if (nextIds.length < limit && !nextIds.includes(questId)) {
      nextIds.push(questId)
    }
  })
  return nextIds.slice(0, limit)
}

function rotateIdsAfter(candidateIds: string[], previousIds: string[]) {
  if (!candidateIds.length) {
    return candidateIds
  }

  const lastPreviousIndex = previousIds.reduce(
    (lastIndex, questId) => Math.max(lastIndex, candidateIds.indexOf(questId)),
    -1,
  )
  if (lastPreviousIndex < 0) {
    return candidateIds
  }

  const start = (lastPreviousIndex + 1) % candidateIds.length
  return [...candidateIds.slice(start), ...candidateIds.slice(0, start)]
}

function idsToQuests(quests: Quest[], ids: string[]) {
  const questById = new Map(quests.map((quest) => [quest.id, quest]))
  return ids
    .map((questId) => questById.get(questId))
    .filter((quest): quest is Quest => Boolean(quest))
}

function pickRotating<T>(items: T[], seed: string, count: number) {
  if (items.length <= count) {
    return items
  }

  const start = hashSeed(seed) % items.length
  return Array.from({ length: count }, (_, index) => items[(start + index) % items.length])
}

function flowersRequiredForLevel(level: number) {
  if (level <= 1) {
    return 0
  }

  const knownRequirement = LEVEL_REQUIREMENTS[level - 1]
  if (knownRequirement !== undefined) {
    return knownRequirement
  }

  let required = LEVEL_REQUIREMENTS[LEVEL_REQUIREMENTS.length - 1]
  for (let nextLevel = LEVEL_REQUIREMENTS.length + 1; nextLevel <= level; nextLevel += 1) {
    required += 18 + nextLevel * 4
  }
  return required
}

function hashSeed(seed: string) {
  return seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function isAfterLongTermDeadline(
  currentDate: string,
  startedAt: string,
  quest: Quest,
) {
  return dateDiffDays(getLongTermDueDate(startedAt, quest), currentDate) > 0
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function formatWeekdaySchedule(daysOfWeek: Weekday[]) {
  const names = [...new Set(daysOfWeek)]
    .sort((left, right) => left - right)
    .map((weekday) => WEEKDAY_NAMES[weekday])

  if (names.length === 0) {
    return 'Scheduled day'
  }
  if (names.length === 1) {
    return `Every ${names[0]}`
  }
  if (names.length === 2) {
    return `Every ${names[0]} and ${names[1]}`
  }
  return `Every ${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
}

function getFlexiblePeriodStart(
  state: HanaGameState,
  quest: Quest,
  dateKey: string,
  periodDays: number,
  anchor: 'calendarWeek' | 'profileStart' | 'questStart',
) {
  if (anchor === 'calendarWeek') {
    return getSkipWeekKey(dateKey)
  }

  const anchorDate =
    anchor === 'questStart'
      ? quest.createdDate ?? dateKey
      : state.startDate ?? dateKey
  const elapsedDays = Math.max(0, dateDiffDays(anchorDate, dateKey))
  return addDays(
    anchorDate,
    Math.floor(elapsedDays / periodDays) * periodDays,
  )
}

function countQuestCompletionsInPeriod(
  state: HanaGameState,
  questId: string,
  periodStart: string,
  periodEnd: string,
) {
  return Object.entries(state.dailyCompletions).reduce(
    (total, [completionDate, completions]) =>
      completionDate >= periodStart &&
      completionDate <= periodEnd &&
      completions[questId]
        ? total + 1
        : total,
    0,
  )
}

function countQuestOccurrencesInPeriod(
  state: HanaGameState,
  questId: string,
  periodStart: string,
  periodEnd: string,
) {
  return Object.entries(state.habitOccurrences ?? {}).reduce(
    (total, [occurrenceDate, occurrences]) =>
      occurrenceDate >= periodStart && occurrenceDate <= periodEnd
        ? total + Math.max(0, occurrences[questId] ?? 0)
        : total,
    0,
  )
}

function dateDiffDays(fromDateKey: string, toDateKey: string) {
  const from = parseDateKey(fromDateKey)
  const to = parseDateKey(toDateKey)
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

function displayShortDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getLegacySundayWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey)
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - date.getDay())
  return formatDateKey(sunday)
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = parseDateKey(value)
  return !Number.isNaN(date.getTime()) && formatDateKey(date) === value
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) {
    return new Date()
  }
  return new Date(year, month - 1, day, 12)
}

function normalizeHanaState(
  value: unknown,
  quests: Quest[],
  options: QuestPlanOptions = {},
): HanaGameState {
  if (!isRecord(value)) {
    return createInitialHanaState()
  }

  const currentDate =
    typeof value.currentDate === 'string' ? value.currentDate : todayKey()
  const startDate =
    typeof value.startDate === 'string' && value.startDate.length > 0
      ? value.startDate
      : null

  const migratedState: HanaGameState = {
    startDate,
    currentDate,
    customHabits: readCustomHabits(value.customHabits, quests),
    activeDailyQuests: readActiveQuestRecord(value.activeDailyQuests),
    activeLongTermQuestIds: readStringArray(value.activeLongTermQuestIds),
    dailyCompletions: readCompletionRecord(value.dailyCompletions),
    habitOccurrences: readOccurrenceRecord(value.habitOccurrences),
    longTermWindows: readWindowRecord(value.longTermWindows),
    longTermCompletions: readCompletionRecord(value.longTermCompletions),
    questSkips: readCompletionRecord(value.questSkips),
    eveningWeeds: readCompletionRecord(value.eveningWeeds),
    totalFlowers: 0,
  }

  const legacyWeeklyCompletions = readCompletionRecord(value.weeklyCompletions)
  Object.entries(legacyWeeklyCompletions).forEach(([weekKey, completions]) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      if (isComplete) {
        migratedState.longTermCompletions[questId] = {
          ...migratedState.longTermCompletions[questId],
          [weekKey]: true,
        }
        migratedState.longTermWindows[questId] ??= weekKey
      }
    })
  })

  // Migrate the earliest single `completions[date][quest]` shape into
  // daily/long-term buckets so existing local progress keeps working.
  const legacyCompletions = readCompletionRecord(value.completions)
  const catalog = getQuestCatalog(quests, migratedState)
  const questById = new Map(catalog.map((quest) => [quest.id, quest]))
  Object.entries(legacyCompletions).forEach(([dateKey, completions]) => {
    Object.entries(completions).forEach(([questId, isComplete]) => {
      if (!isComplete) {
        return
      }

      const quest = questById.get(questId)
      if (quest?.group === 'longTerm') {
        const windowStart = getLegacySundayWeekKey(dateKey)
        migratedState.longTermCompletions[questId] = {
          ...migratedState.longTermCompletions[questId],
          [windowStart]: true,
        }
        migratedState.longTermWindows[questId] ??= windowStart
      } else {
        migratedState.dailyCompletions[dateKey] = {
          ...migratedState.dailyCompletions[dateKey],
          [questId]: true,
        }
      }
    })
  })

  migratedState.totalFlowers = recomputeTotalFlowers(migratedState, catalog)
  return syncActiveQuestPlan(migratedState, catalog, options)
}

function readCustomHabits(value: unknown, baseQuests: Quest[]) {
  if (!Array.isArray(value)) {
    return []
  }

  const seenIds = new Set(baseQuests.map((quest) => quest.id))
  const seenTitles = new Set(
    baseQuests.map((quest) => quest.title.trim().toLocaleLowerCase()),
  )

  return value.reduce<CustomHabitQuest[]>((result, item) => {
    const habit = readCustomHabit(item)
    if (!habit) {
      return result
    }
    const titleKey = habit.title.toLocaleLowerCase()
    if (seenIds.has(habit.id) || seenTitles.has(titleKey)) {
      return result
    }

    seenIds.add(habit.id)
    seenTitles.add(titleKey)
    result.push(habit)
    return result
  }, [])
}

function readCustomHabit(value: unknown): CustomHabitQuest | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readTrimmedString(value.id, 120)
  const title = readTrimmedString(value.title, 60)
  const description = readTrimmedString(value.description, 180)
  const emoji = readTrimmedString(value.emoji, 8)
  const color = readTrimmedString(value.color, 7)
  const createdDate = isDateKey(value.createdDate) ? value.createdDate : null
  const difficulty =
    value.difficulty === 'easy' ||
    value.difficulty === 'medium' ||
    value.difficulty === 'hard'
      ? value.difficulty
      : null
  const schedule = readQuestSchedule(value.schedule)

  if (
    !id ||
    !id.startsWith('custom-') ||
    id.includes(':') ||
    !title ||
    !description ||
    !emoji ||
    !color?.match(/^#[0-9a-f]{6}$/i) ||
    !createdDate ||
    !difficulty ||
    !schedule
  ) {
    return null
  }

  const habit: CustomHabitQuest = {
    id,
    title,
    description,
    emoji,
    color,
    difficulty,
    group: 'daily',
    required: true,
    minLevel: 1,
    schedule,
    custom: true,
    createdDate,
  }
  return hasValidCustomHabitSchedule(habit) ? habit : null
}

function readQuestSchedule(value: unknown): QuestSchedule | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null
  }
  if (value.kind === 'daily') {
    return { kind: 'daily' }
  }
  if (value.kind === 'weekly') {
    if (!Array.isArray(value.daysOfWeek)) {
      return null
    }
    const daysOfWeek = value.daysOfWeek.filter(
      (weekday): weekday is Weekday =>
        typeof weekday === 'number' &&
        Number.isInteger(weekday) &&
        weekday >= 0 &&
        weekday <= 6,
    )
    if (daysOfWeek.length !== value.daysOfWeek.length) {
      return null
    }
    return {
      kind: 'weekly',
      daysOfWeek,
    }
  }
  if (
    value.kind === 'periodTarget' &&
    typeof value.target === 'number' &&
    typeof value.periodDays === 'number' &&
    Number.isInteger(value.target) &&
    Number.isInteger(value.periodDays) &&
    (value.anchor === 'calendarWeek' || value.anchor === 'questStart')
  ) {
    return {
      kind: 'periodTarget',
      target: value.target,
      periodDays: value.periodDays,
      anchor: value.anchor,
    }
  }
  if (
    value.kind !== 'quota' ||
    typeof value.target !== 'number' ||
    typeof value.periodDays !== 'number' ||
    !Number.isInteger(value.target) ||
    !Number.isInteger(value.periodDays)
  ) {
    return null
  }
  if (value.anchor === 'calendarWeek' && value.periodDays === 7) {
    return {
      kind: 'quota',
      target: value.target,
      periodDays: 7,
      anchor: 'calendarWeek',
    }
  }
  if (value.anchor === 'profileStart' || value.anchor === 'questStart') {
    return {
      kind: 'quota',
      target: value.target,
      periodDays: value.periodDays,
      anchor: value.anchor,
    }
  }
  return null
}

function readTrimmedString(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maximumLength ? trimmed : null
}

function readCompletionRecord(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, Record<string, boolean>>>(
    (result, [periodKey, completions]) => {
      if (!isRecord(completions)) {
        return result
      }

      result[periodKey] = Object.entries(completions).reduce<
        Record<string, boolean>
      >((periodResult, [questId, isComplete]) => {
        if (typeof isComplete === 'boolean') {
          periodResult[questId] = isComplete
        }
        return periodResult
      }, {})

      return result
    },
    {},
  )
}

function readOccurrenceRecord(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, Record<string, number>>>(
    (result, [dateKey, occurrences]) => {
      if (!isDateKey(dateKey) || !isRecord(occurrences)) {
        return result
      }

      const validOccurrences = Object.entries(occurrences).reduce<
        Record<string, number>
      >((dateResult, [questId, count]) => {
        if (
          typeof count === 'number' &&
          Number.isSafeInteger(count) &&
          count > 0 &&
          count <= PERIOD_TARGET_LIMITS.target
        ) {
          dateResult[questId] = count
        }
        return dateResult
      }, {})

      if (Object.keys(validOccurrences).length > 0) {
        result[dateKey] = validOccurrences
      }
      return result
    },
    {},
  )
}

function readWindowRecord(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [questId, startedAt]) => {
      if (typeof startedAt === 'string') {
        result[questId] = startedAt
      }
      return result
    },
    {},
  )
}

function readActiveQuestRecord(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, string[]>>(
    (result, [dateKey, questIds]) => {
      if (Array.isArray(questIds)) {
        result[dateKey] = questIds.filter(
          (questId): questId is string => typeof questId === 'string',
        )
      }
      return result
    },
    {},
  )
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
