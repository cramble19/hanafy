import {
  createProfileCloudSyncPayload,
  type HanaProfileId,
} from '@/lib/hanaCloudSync'
import {
  getLongTermDueDate,
  getQuestCatalog,
  getQuestScheduleProgress,
} from '@/lib/hanaGame'
import type { HanaGameState, Quest, Weekday } from '@/types'
import {
  isHabitPausedOnDate,
  isHabitArchivedOnDate,
  isHabitGraduatedOnDate,
  isHabitTrackableOnDate,
  MAX_BACKFILL_DAYS,
} from '@/lib/habitLifecycle'

export type HabitStatsRange = 7 | 30 | 90 | 'all'
export type HabitPeriodStatus =
  | 'completed'
  | 'skipped'
  | 'missed'
  | 'open'
  | 'paused'

export type HabitPeriodStat = {
  periodKey: string
  startDate: string
  endDate: string
  completed: number
  target: number
  status: HabitPeriodStatus
}

export type HabitDayStat = {
  dateKey: string
  count: number
  /** The habit could be recorded that day; this is never a miss indicator. */
  isEligible: boolean
  isPaused: boolean
  isToday: boolean
}

export type HabitRangeStats = {
  quest: Quest
  range: HabitStatsRange
  rangeStart: string
  rangeEnd: string
  activeDays: number
  completedPeriods: number
  missedPeriods: number
  skippedPeriods: number
  pausedPeriods: number
  decidedPeriods: number
  successRate: number
  totalRecords: number
  weeklyPace: number
  currentPeriod: HabitPeriodStat | null
  nextDueDate: string | null
  periods: HabitPeriodStat[]
  days: HabitDayStat[]
  weekdayRecords: Array<{
    weekday: number
    label: string
    records: number
  }>
}

export type HabitMomentumSignal = {
  kind: 'combo' | 'needsCare'
  emoji: string
  label: string
  ariaLabel: string
  windowCount: number
}

export type QuestStat = {
  questId: string
  title: string
  color: string
  emoji: string
  shown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
}

export type DailyStat = {
  dateKey: string
  shown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
}

export type QuestHistoryDay = {
  dateKey: string
  status: HabitPeriodStatus
  flowersEarned: number
}

export type QuestHistory = {
  stat: QuestStat
  days: QuestHistoryDay[]
}

export type WeedHistory = {
  weedId: string
  checked: number
  dates: string[]
}

export type HanaStats = {
  totalShown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
  skipRate: number
  currentWeek: {
    shown: number
    completed: number
    skipped: number
    missed: number
    open: number
    completionRate: number
    days: DailyStat[]
  }
  questStats: QuestStat[]
  mostBlooming: QuestStat[]
  needsLove: QuestStat[]
  weedStats: Array<{
    weedId: string
    checked: number
  }>
}

export function getHanaStats(state: HanaGameState, quests: Quest[]): HanaStats {
  return getProfileStats(state, quests, 'hana')
}

export function getProfileStats(
  state: HanaGameState,
  quests: Quest[],
  profileId: HanaProfileId,
): HanaStats {
  const catalog = getQuestCatalog(quests, state)
  const payload = createProfileCloudSyncPayload(profileId, state, catalog)
  const questById = new Map(catalog.map((quest) => [quest.id, quest]))
  const questStats = new Map<string, QuestStat>()
  const dailyStats = new Map<string, DailyStat>()
  const currentWeekStart = getWeekStartKey(state.currentDate)

  payload.questStatuses.forEach((row) => {
    const status = resolveStatus(row, state.currentDate)
    const quest = questById.get(row.questId)
    const periodStart = row.windowStart ?? row.dateKey ?? row.periodKey
    const periodEnd = row.dueDate ?? row.dateKey ?? row.periodKey
    if (
      status === 'paused' ||
      status !== 'completed' &&
      isPeriodPaused(state, row.questId, periodStart, periodEnd)
    ) {
      return
    }
    const stat = questStats.get(row.questId) ?? {
      questId: row.questId,
      title: quest?.title ?? row.questId,
      color: quest?.color ?? '#d98ba0',
      emoji: quest?.emoji ?? '🌸',
      shown: 0,
      completed: 0,
      skipped: 0,
      missed: 0,
      open: 0,
      completionRate: 0,
    }

    stat.shown += 1
    stat[status] += 1
    stat.completionRate = percent(stat.completed, stat.completed + stat.missed)
    questStats.set(row.questId, stat)

    const dateKey = row.dateKey ?? row.windowStart
    if (!dateKey || dateKey < currentWeekStart || dateKey > state.currentDate) {
      return
    }

    const dailyStat = dailyStats.get(dateKey) ?? {
      dateKey,
      shown: 0,
      completed: 0,
      skipped: 0,
      missed: 0,
      open: 0,
      completionRate: 0,
    }
    dailyStat.shown += 1
    dailyStat[status] += 1
    dailyStat.completionRate = percent(
      dailyStat.completed,
      dailyStat.completed + dailyStat.missed,
    )
    dailyStats.set(dateKey, dailyStat)
  })

  const totals = sumStats(Array.from(questStats.values()))
  const currentWeekDays = fillWeekDays(currentWeekStart, state.currentDate, dailyStats)
  const currentWeekTotals = sumStats(currentWeekDays)
  const sortedQuestStats = Array.from(questStats.values()).sort((first, second) =>
    first.title.localeCompare(second.title),
  )
  const mostBlooming = sortedQuestStats
    .filter((stat) => stat.completed > 0)
    .sort(
      (first, second) =>
        second.completed - first.completed ||
        second.completionRate - first.completionRate ||
        first.title.localeCompare(second.title),
    )
    .slice(0, 3)
  const needsLove = sortedQuestStats
    .filter((stat) => stat.missed > 0)
    .sort(
      (first, second) =>
        second.missed - first.missed ||
        first.completionRate - second.completionRate ||
        first.title.localeCompare(second.title),
    )
    .slice(0, 3)

  return {
    ...totals,
    currentWeek: {
      ...currentWeekTotals,
      days: currentWeekDays,
    },
    questStats: sortedQuestStats,
    mostBlooming,
    needsLove,
    weedStats: getWeedStats(state),
  }
}

export function getQuestHistory(
  state: HanaGameState,
  quests: Quest[],
  questId: string,
): QuestHistory {
  const catalog = getQuestCatalog(quests, state)
  const payload = createProfileCloudSyncPayload('hana', state, catalog)
  const quest = catalog.find((item) => item.id === questId)
  const days = payload.questStatuses
    .filter((row) => row.questId === questId)
    .map((row) => ({
      dateKey: row.dateKey ?? row.windowStart ?? row.periodKey,
      status: resolveStatus(row, state.currentDate),
      flowersEarned: row.flowersEarned,
    }))
    .sort((first, second) => first.dateKey.localeCompare(second.dateKey))

  const completed = days.filter((day) => day.status === 'completed').length
  const skipped = days.filter((day) => day.status === 'skipped').length
  const missed = days.filter((day) => day.status === 'missed').length
  const open = days.filter((day) => day.status === 'open').length
  const shown = completed + skipped + missed + open

  return {
    stat: {
      questId,
      title: quest?.title ?? questId,
      color: quest?.color ?? '#d98ba0',
      emoji: quest?.emoji ?? '🌸',
      shown,
      completed,
      skipped,
      missed,
      open,
      completionRate: percent(completed, completed + missed),
    },
    days,
  }
}

/**
 * Builds a truthful per-habit history from the saved schedule and raw records.
 * Flexible habits are represented once per scoring window, while `days` keeps
 * the exact occurrence counts used by the activity grid.
 */
export function getHabitRangeStats(
  state: HanaGameState,
  quests: Quest[],
  profileId: HanaProfileId,
  questId: string,
  range: HabitStatsRange,
): HabitRangeStats | null {
  const catalog = getQuestCatalog(quests, state)
  const quest = catalog.find((item) => item.id === questId)
  if (!quest) return null

  const activeStart = getQuestActiveStart(state, quest)
  const historyStart = activeStart ?? state.currentDate
  const requestedStart =
    range === 'all' ? historyStart : addDays(state.currentDate, -(range - 1))
  const rangeStart =
    requestedStart < historyStart ? historyStart : requestedStart
  const rangeEnd = state.currentDate
  const days = buildHabitDays(state, quest, rangeStart, rangeEnd)
  const allPeriods = activeStart
    ? quest.group === 'longTerm'
      ? buildLongTermPeriods(state, catalog, profileId, quest)
      : buildDailyGroupPeriods(state, quest, activeStart, rangeEnd)
    : []
  const periods = allPeriods.filter((period) =>
    isPeriodInRange(period, rangeStart, rangeEnd),
  )
  const currentPeriod =
    allPeriods.find(
      (period) =>
        period.startDate <= state.currentDate &&
        period.endDate >= state.currentDate,
    ) ?? null
  const completedPeriods = periods.filter(
    ({ status }) => status === 'completed',
  ).length
  const missedPeriods = periods.filter(
    ({ status }) => status === 'missed',
  ).length
  const skippedPeriods = periods.filter(
    ({ status }) => status === 'skipped',
  ).length
  const pausedPeriods = periods.filter(
    ({ status }) => status === 'paused',
  ).length
  const decidedPeriods = completedPeriods + missedPeriods
  const totalRecords = days.reduce((total, day) => total + day.count, 0)
  const activeDays = Math.max(
    1,
    days.filter((day) => !day.isPaused).length,
  )
  const weekdayRecords = WEEKDAY_SHORT_NAMES.map((label, weekday) => ({
    weekday,
    label,
    records: days.reduce(
      (total, day) =>
        parseDateKey(day.dateKey).getDay() === weekday
          ? total + day.count
          : total,
      0,
    ),
  }))

  return {
    quest,
    range,
    rangeStart,
    rangeEnd,
    activeDays,
    completedPeriods,
    missedPeriods,
    skippedPeriods,
    pausedPeriods,
    decidedPeriods,
    successRate: percent(completedPeriods, decidedPeriods),
    totalRecords,
    weeklyPace: Math.round((totalRecords / activeDays) * 70) / 10,
    currentPeriod,
    nextDueDate: getNextDueDate(state, quest, currentPeriod),
    periods,
    days,
    weekdayRecords,
  }
}

export function formatQuestCadence(quest: Quest) {
  if (quest.group === 'longTerm') {
    const days = quest.durationDays ?? 7
    return `Once every ${days} ${days === 1 ? 'day' : 'days'}`
  }

  const schedule = quest.schedule ?? { kind: 'daily' as const }
  if (schedule.kind === 'daily') return 'Once daily'
  if (schedule.kind === 'weekly') {
    const names = schedule.daysOfWeek
      .map((weekday) => WEEKDAY_LONG_NAMES[weekday])
      .filter(Boolean)
    if (names.length === 1) return `Every ${names[0]}`
    if (names.length === 2) return `Every ${names[0]} and ${names[1]}`
    return `On ${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
  }

  const target = schedule.target
  const countLabel = target === 1 ? 'Once' : `${target} times`
  if (schedule.periodDays === 1) {
    return target === 1 ? 'Once daily' : `${target} times daily`
  }
  if (schedule.anchor === 'calendarWeek' && schedule.periodDays === 7) {
    return target === 1
      ? 'Once each calendar week'
      : `${target} times each calendar week`
  }
  return `${countLabel} every ${schedule.periodDays} days`
}

/**
 * Returns a sparse, evidence-based motivation cue. Open windows and passes are
 * deliberately neutral; a signal appears only after enough resolved windows.
 */
export function getHabitMomentumSignal(
  stats: Pick<HabitRangeStats, 'periods'>,
  profileId: HanaProfileId,
): HabitMomentumSignal | null {
  const resolved = [...stats.periods]
    .filter(
      (period) =>
        period.status === 'completed' || period.status === 'missed',
    )
    .sort((first, second) => second.startDate.localeCompare(first.startDate))

  let combo = 0
  for (const period of resolved) {
    if (period.status !== 'completed') break
    combo += 1
  }
  if (combo >= 2) {
    return {
      kind: 'combo',
      emoji: '🔥',
      label: `${combo} combo`,
      ariaLabel: `On fire: ${combo} consecutive goal windows met. Open and passed windows are neutral.`,
      windowCount: combo,
    }
  }

  const recentFour = resolved.slice(0, 4)
  if (
    recentFour.length === 4 &&
    recentFour[0].status === 'missed' &&
    recentFour.filter((period) => period.status === 'completed').length === 3
  ) {
    return {
      kind: 'combo',
      emoji: '🔥',
      label: 'Strong rhythm',
      ariaLabel:
        'Strong rhythm: three of the last four resolved goal windows were met. One unfinished window does not erase that progress.',
      windowCount: 3,
    }
  }

  const latestResolved = resolved.slice(0, 3)
  if (
    latestResolved.length === 3 &&
    latestResolved.every((period) => period.status === 'missed')
  ) {
    return {
      kind: 'needsCare',
      emoji: profileId === 'hana' ? '🥀' : '🕯️',
      label: profileId === 'hana' ? 'Needs care' : 'Rekindle',
      ariaLabel:
        'Ready to rebuild: the last three resolved goal windows were unfinished. One completed window begins the comeback. Open and passed windows are neutral.',
      windowCount: 3,
    }
  }

  return null
}

const WEEKDAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LONG_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function getQuestActiveStart(state: HanaGameState, quest: Quest) {
  const profileStart = state.startDate ?? state.currentDate
  const activationDate = state.questActivations?.[quest.id]
  const configuredStart = [profileStart, quest.createdDate, activationDate]
    .filter((dateKey): dateKey is string => Boolean(dateKey))
    .sort()
    .at(-1) as string
  if (activationDate) return configuredStart
  // Pre-v4 snapshots did not persist explicit activation dates. Keep their
  // original required/custom history boundary until normalization materializes
  // the activation map; v4 available quests use an empty map and stay neutral.
  if (
    state.questActivations === undefined &&
    ((quest.minLevel ?? 1) <= 1 || quest.custom)
  ) {
    return configuredStart
  }

  const firstPresentedDate = Object.entries(state.activeDailyQuests ?? {})
    .filter(([, questIds]) => questIds.includes(quest.id))
    .map(([dateKey]) => dateKey)
    .sort()[0]
  const firstLongTermWindow = state.longTermWindows?.[quest.id]
  const firstRecordedDate = [
    ...Object.entries(state.dailyCompletions ?? {})
      .filter(([, records]) => records[quest.id] === true)
      .map(([dateKey]) => dateKey),
    ...Object.entries(state.habitOccurrences ?? {})
      .filter(([, records]) => (records[quest.id] ?? 0) > 0)
      .map(([dateKey]) => dateKey),
    ...Object.keys(state.longTermCompletions?.[quest.id] ?? {}),
  ].sort()[0]
  const firstEvidence = [firstPresentedDate, firstLongTermWindow, firstRecordedDate]
    .filter((dateKey): dateKey is string => Boolean(dateKey))
    .sort()[0]
  if (!firstEvidence) return null
  return firstEvidence > configuredStart
    ? firstEvidence
    : configuredStart
}

function buildHabitDays(
  state: HanaGameState,
  quest: Quest,
  startDate: string,
  endDate: string,
) {
  if (startDate > endDate) return []

  return listDateKeys(startDate, endDate).map<HabitDayStat>((dateKey) => ({
    dateKey,
    count: getHabitRecordCount(state, quest, dateKey),
    isEligible: isHabitAvailableOnDate(state, quest, dateKey),
    isPaused:
      isHabitPausedOnDate(state, quest.id, dateKey) ||
      isHabitArchivedOnDate(state, quest.id, dateKey) ||
      isHabitGraduatedOnDate(state, quest.id, dateKey),
    isToday: dateKey === state.currentDate,
  }))
}

function buildDailyGroupPeriods(
  state: HanaGameState,
  quest: Quest,
  activeStart: string,
  currentDate: string,
) {
  const schedule = quest.schedule ?? { kind: 'daily' as const }
  if (schedule.kind === 'quota' || schedule.kind === 'periodTarget') {
    const periods = new Map<string, HabitPeriodStat>()
    const skippedPeriods = getSkippedDailyDates(state, quest.id)
    const canDeriveEveryWindow =
      (quest.minLevel ?? 1) <= 1 && Boolean(quest.required || quest.custom)
    listDateKeys(activeStart, currentDate)
      .filter(
        (dateKey) =>
          (canDeriveEveryWindow &&
            !isHabitArchivedOnDate(state, quest.id, dateKey)) ||
          isHabitAvailableOnDate(state, quest, dateKey) ||
          getHabitRecordCount(state, quest, dateKey) > 0,
      )
      .forEach((dateKey) => {
        const progress = getQuestScheduleProgress(state, quest, dateKey)
        if (periods.has(progress.periodStart)) return
        periods.set(progress.periodStart, {
          periodKey: progress.periodStart,
          startDate: progress.periodStart,
          endDate: progress.periodEnd,
          completed: progress.completed,
          target: progress.target,
          status: progress.isComplete
            ? 'completed'
            : skippedPeriods.has(progress.periodStart)
              ? 'skipped'
            : isPeriodPaused(state, quest.id, progress.periodStart, progress.periodEnd)
              ? 'paused'
              : isPastCorrectionWindow(progress.periodEnd, currentDate)
                ? 'missed'
                : 'open',
        })
      })
    return Array.from(periods.values()).sort((first, second) =>
      first.startDate.localeCompare(second.startDate),
    )
  }

  const skippedDates = getSkippedDailyDates(state, quest.id)
  return listDateKeys(activeStart, currentDate)
    .filter(
      (dateKey) =>
        isHabitAvailableOnDate(state, quest, dateKey) ||
        getHabitRecordCount(state, quest, dateKey) > 0,
    )
    .map<HabitPeriodStat>((dateKey) => {
      const completed = getHabitRecordCount(state, quest, dateKey)
      return {
        periodKey: dateKey,
        startDate: dateKey,
        endDate: dateKey,
        completed,
        target: 1,
        status:
          completed >= 1
            ? 'completed'
            : skippedDates.has(dateKey)
              ? 'skipped'
              : isHabitPausedOnDate(state, quest.id, dateKey)
                ? 'paused'
                : isPastCorrectionWindow(dateKey, currentDate)
                  ? 'missed'
                  : 'open',
      }
    })
}

function buildLongTermPeriods(
  state: HanaGameState,
  catalog: Quest[],
  profileId: HanaProfileId,
  quest: Quest,
) {
  const payload = createProfileCloudSyncPayload(profileId, state, catalog)
  return payload.questStatuses
    .filter((row) => row.questId === quest.id)
    .map<HabitPeriodStat>((row) => {
      const startDate = row.windowStart ?? row.dateKey ?? row.periodKey
      const endDate = row.dueDate ?? getLongTermDueDate(startDate, quest)
      const status = resolveStatus(row, state.currentDate)
      const resolvedStatus =
        status !== 'completed' &&
        isPeriodPaused(state, quest.id, startDate, endDate)
          ? 'paused'
          : status
      return {
        periodKey: row.periodKey,
        startDate,
        endDate,
        completed: resolvedStatus === 'completed' ? 1 : 0,
        target: 1,
        status: resolvedStatus,
      }
    })
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
}

function getHabitRecordCount(
  state: HanaGameState,
  quest: Quest,
  dateKey: string,
) {
  if (quest.schedule?.kind === 'periodTarget') {
    return Math.max(0, state.habitOccurrences?.[dateKey]?.[quest.id] ?? 0)
  }
  return state.dailyCompletions?.[dateKey]?.[quest.id] ? 1 : 0
}

function isHabitAvailableOnDate(
  state: HanaGameState,
  quest: Quest,
  dateKey: string,
) {
  if (quest.group !== 'daily') return false
  if (quest.createdDate && dateKey < quest.createdDate) return false
  if (!isHabitTrackableOnDate(state, quest.id, dateKey)) return false

  const schedule = quest.schedule ?? { kind: 'daily' as const }
  const wasPresented = Boolean(
    state.activeDailyQuests?.[dateKey]?.includes(quest.id),
  )
  const hasRecord = getHabitRecordCount(state, quest, dateKey) > 0
  if (
    ((quest.minLevel ?? 1) > 1 || (!quest.required && !quest.custom)) &&
    !wasPresented &&
    !hasRecord
  ) {
    return false
  }
  if (schedule.kind === 'quota' || schedule.kind === 'periodTarget') {
    return isDateAvailableInFlexiblePeriod(state, quest, dateKey)
  }
  if (schedule.kind === 'weekly') {
    const weekday = parseDateKey(dateKey).getDay() as Weekday
    if (!schedule.daysOfWeek.includes(weekday)) {
      return false
    }
  }
  return true
}

function isDateAvailableInFlexiblePeriod(
  state: HanaGameState,
  quest: Quest,
  dateKey: string,
) {
  const progress = getQuestScheduleProgress(state, quest, dateKey)
  if (!progress.isComplete) return true

  let runningTotal = 0
  for (const candidate of listDateKeys(
    progress.periodStart,
    progress.periodEnd < state.currentDate
      ? progress.periodEnd
      : state.currentDate,
  )) {
    runningTotal += getHabitRecordCount(state, quest, candidate)
    if (runningTotal >= progress.target) {
      return dateKey <= candidate
    }
  }
  return true
}

function getSkippedDailyDates(state: HanaGameState, questId: string) {
  const prefix = `daily:${questId}:`
  return new Set(
    Object.values(state.questSkips ?? {})
      .flatMap((skips) =>
        Object.entries(skips)
          .filter(([key, isSkipped]) => isSkipped && key.startsWith(prefix))
          .map(([key]) => key.slice(prefix.length)),
      ),
  )
}

function getNextDueDate(
  state: HanaGameState,
  quest: Quest,
  currentPeriod: HabitPeriodStat | null,
) {
  const currentDate = state.currentDate
  if (quest.group !== 'daily') return null
  if (!isHabitTrackableOnDate(state, quest.id, currentDate)) return null
  const schedule = quest.schedule ?? { kind: 'daily' as const }
  if (schedule.kind === 'quota' || schedule.kind === 'periodTarget') {
    if (!currentPeriod) return null
    return currentPeriod.status === 'completed'
      ? addDays(currentPeriod.endDate, schedule.periodDays)
      : currentPeriod.endDate
  }
  if (schedule.kind === 'daily') {
    return currentPeriod?.status === 'completed' ||
      currentPeriod?.status === 'skipped'
      ? addDays(currentDate, 1)
      : currentDate
  }

  const currentOpportunityClosed =
    currentPeriod?.status === 'completed' ||
    currentPeriod?.status === 'skipped'
  for (
    let offset = currentOpportunityClosed ? 1 : 0;
    offset <= 7;
    offset += 1
  ) {
    const candidate = addDays(currentDate, offset)
    const weekday = parseDateKey(candidate).getDay() as Weekday
    if (schedule.daysOfWeek.includes(weekday)) {
      return candidate
    }
  }
  return null
}

function isPeriodInRange(
  period: HabitPeriodStat,
  rangeStart: string,
  rangeEnd: string,
) {
  const containsRangeEnd =
    period.startDate <= rangeEnd && period.endDate >= rangeEnd
  return (
    containsRangeEnd ||
    (period.endDate >= rangeStart && period.endDate <= rangeEnd)
  )
}

function listDateKeys(startDate: string, endDate: string) {
  const dates: string[] = []
  let dateKey = startDate
  while (dateKey <= endDate) {
    dates.push(dateKey)
    dateKey = addDays(dateKey, 1)
  }
  return dates
}

function dateDiffDays(fromDateKey: string, toDateKey: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round(
    (parseDateKey(toDateKey).getTime() - parseDateKey(fromDateKey).getTime()) /
      millisecondsPerDay,
  )
}

function isPastCorrectionWindow(periodEnd: string, currentDate: string) {
  return dateDiffDays(periodEnd, currentDate) > MAX_BACKFILL_DAYS
}

function isPeriodPaused(
  state: HanaGameState,
  habitId: string,
  startDate: string,
  endDate: string,
) {
  return listDateKeys(startDate, endDate).some((dateKey) =>
    isHabitPausedOnDate(state, habitId, dateKey) ||
    isHabitArchivedOnDate(state, habitId, dateKey) ||
    isHabitGraduatedOnDate(state, habitId, dateKey),
  )
}

export function getWeedHistory(
  state: HanaGameState,
  weedId: string,
): WeedHistory {
  const dates = Object.entries(state.eveningWeeds ?? {})
    .filter(([, weeds]) => Boolean(weeds[weedId]))
    .map(([dateKey]) => dateKey)
    .sort()

  return {
    weedId,
    checked: dates.length,
    dates,
  }
}

export function getCalendarWindow(currentDateKey: string, daysToShow = 35) {
  const startDate = parseDateKey(currentDateKey)
  startDate.setDate(startDate.getDate() - (daysToShow - 1))

  return Array.from({ length: daysToShow }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return formatDateKey(date)
  })
}

function resolveStatus(
  row: ReturnType<typeof createProfileCloudSyncPayload>['questStatuses'][number],
  currentDate: string,
): HabitPeriodStatus {
  if (
    row.status === 'completed' ||
    row.status === 'skipped' ||
    row.status === 'paused'
  ) {
    return row.status
  }

  if (row.questGroup === 'daily') {
    if (row.dateKey) {
      return isPastCorrectionWindow(row.dateKey, currentDate) ? 'missed' : 'open'
    }
    return row.dueDate && isPastCorrectionWindow(row.dueDate, currentDate)
      ? 'missed'
      : 'open'
  }

  return row.dueDate && isPastCorrectionWindow(row.dueDate, currentDate)
    ? 'missed'
    : 'open'
}

function sumStats(
  stats: Array<Pick<QuestStat, 'shown' | 'completed' | 'skipped' | 'missed' | 'open'>>,
) {
  const totals = stats.reduce(
    (result, stat) => ({
      shown: result.shown + stat.shown,
      completed: result.completed + stat.completed,
      skipped: result.skipped + stat.skipped,
      missed: result.missed + stat.missed,
      open: result.open + stat.open,
    }),
    { shown: 0, completed: 0, skipped: 0, missed: 0, open: 0 },
  )

  return {
    shown: totals.shown,
    totalShown: totals.shown,
    completed: totals.completed,
    skipped: totals.skipped,
    missed: totals.missed,
    open: totals.open,
    completionRate: percent(
      totals.completed,
      totals.completed + totals.missed,
    ),
    skipRate: percent(totals.skipped, totals.shown),
  }
}

function getWeedStats(state: HanaGameState) {
  const weedCounts = new Map<string, number>()
  Object.values(state.eveningWeeds ?? {}).forEach((weeds) => {
    Object.entries(weeds).forEach(([weedId, checked]) => {
      if (checked) {
        weedCounts.set(weedId, (weedCounts.get(weedId) ?? 0) + 1)
      }
    })
  })

  return Array.from(weedCounts.entries())
    .map(([weedId, checked]) => ({ weedId, checked }))
    .sort((first, second) => second.checked - first.checked)
}

function fillWeekDays(
  startDateKey: string,
  currentDateKey: string,
  dailyStats: Map<string, DailyStat>,
) {
  const days: DailyStat[] = []
  let dateKey = startDateKey

  while (dateKey <= currentDateKey && days.length < 7) {
    days.push(
      dailyStats.get(dateKey) ?? {
        dateKey,
        shown: 0,
        completed: 0,
        skipped: 0,
        missed: 0,
        open: 0,
        completionRate: 0,
      },
    )
    dateKey = addDays(dateKey, 1)
  }

  return days
}

function getWeekStartKey(dateKey: string) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() - date.getDay())
  return formatDateKey(date)
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}
