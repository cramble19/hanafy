import type { Difficulty, HanaGameState, Quest } from '@/types'

export const FLOWERS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

const LEVEL_REQUIREMENTS = [0, 5, 12, 22, 35, 52, 74, 100]
const WEEDS_PER_WILTED_FLOWER = 3
const SPRING_MEMORY_QUEST_ID = 'remember-cramble'
export const WEEKLY_SKIP_LIMIT = 3
export const SPRING_ARC = {
  arcNumber: 1,
  season: 'Spring',
  targetLevel: 5,
  targetFlowers: 35,
  nextSeason: 'Summer',
  nextTheme: 'Consistency & tough choices',
} as const

export const STORAGE_KEY = 'hana-game/v1'

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
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
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

export function hasHanaStarted(state: HanaGameState | null | undefined) {
  return typeof state?.startDate === 'string' && state.startDate.length > 0
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

export function syncActiveQuestPlan(state: HanaGameState, quests: Quest[]) {
  const level = getLevel(state.totalFlowers)
  const dailyIds = selectDailyQuestIds(quests, state.currentDate, level)
  const activeDailyQuests = state.activeDailyQuests ?? {}
  const activeLongTermQuestIds = state.activeLongTermQuestIds ?? []
  const existingDailyIds = activeDailyQuests[state.currentDate] ?? []
  const validExistingDailyIds = existingDailyIds.filter((questId) =>
    dailyIds.includes(questId),
  )
  const nextDailyIds = fillIds(validExistingDailyIds, dailyIds, dailyIds.length)

  const longTermIds = selectLongTermQuestIds(quests, level)
  const validExistingLongTermIds = activeLongTermQuestIds.filter((questId) =>
    longTermIds.includes(questId),
  )
  const nextLongTermIds = fillIds(
    validExistingLongTermIds,
    longTermIds,
    longTermQuestCount(level),
  )

  const nextWindows = { ...state.longTermWindows }
  nextLongTermIds.forEach((questId) => {
    const quest = quests.find((item) => item.id === questId)
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
) {
  return syncActiveQuestPlan(
    {
      ...state,
      currentDate: dateKey,
      totalFlowers: recomputeTotalFlowers(state, quests),
    },
    quests,
  )
}

export function parseStoredHanaState(
  raw: string | null,
  quests: Quest[],
  dateKey = todayKey(),
) {
  if (!raw) {
    return syncStateToDate(createInitialHanaState(), quests, dateKey)
  }

  try {
    return syncStateToDate(
      normalizeHanaState(JSON.parse(raw) as unknown, quests),
      quests,
      dateKey,
    )
  } catch {
    return syncStateToDate(createInitialHanaState(), quests, dateKey)
  }
}

export function recomputeTotalFlowers(state: HanaGameState, quests: Quest[]) {
  const questById = new Map(quests.map((quest) => [quest.id, quest]))

  const countFlowers = (completionGroups: Record<string, Record<string, boolean>>) =>
    Object.values(completionGroups).reduce(
      (total, completions) =>
        total +
        Object.entries(completions).reduce((sum, [questId, isComplete]) => {
          const quest = questById.get(questId)
          return isComplete && quest ? sum + flowersForQuest(quest) : sum
        }, 0),
      0,
    )

  const earnedFlowers =
    countFlowers(state.dailyCompletions) +
    countFlowers(state.longTermCompletions)

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
  const dailyQuestIds = state.activeDailyQuests?.[state.currentDate] ?? []
  const longTermQuestIds = state.activeLongTermQuestIds ?? []

  return {
    daily: idsToQuests(quests, dailyQuestIds),
    longTerm: idsToQuests(quests, longTermQuestIds),
  }
}

export function getSkipWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey)
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - date.getDay())
  return formatDateKey(sunday)
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
      result[quest.id] = Boolean(skipsThisWeek[getSkipEventKey(state, quest)])
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

function selectDailyQuestIds(quests: Quest[], dateKey: string, level: number) {
  const unlockedDailyQuests = quests.filter(
    (quest) => quest.group === 'daily' && (quest.minLevel ?? 1) <= level,
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

  if (requiredQuestIds.length >= limit) {
    return [...springMemoryQuestIds, ...requiredQuestIds.slice(0, limit)]
  }

  return [
    ...springMemoryQuestIds,
    ...requiredQuestIds,
    ...pickRotating(optionalQuestIds, dateKey, limit - requiredQuestIds.length),
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

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) {
    return new Date()
  }
  return new Date(year, month - 1, day, 12)
}

function normalizeHanaState(value: unknown, quests: Quest[]): HanaGameState {
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
    activeDailyQuests: readActiveQuestRecord(value.activeDailyQuests),
    activeLongTermQuestIds: readStringArray(value.activeLongTermQuestIds),
    dailyCompletions: readCompletionRecord(value.dailyCompletions),
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
  const questById = new Map(quests.map((quest) => [quest.id, quest]))
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

  migratedState.totalFlowers = recomputeTotalFlowers(migratedState, quests)
  return syncActiveQuestPlan(migratedState, quests)
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
