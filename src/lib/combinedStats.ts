import { addDays, getQuestCatalog } from '@/lib/hanaGame'
import {
  getHabitRangeStats,
  type HabitPeriodStat,
} from '@/lib/hanaStats'
import { MAX_BACKFILL_DAYS } from '@/lib/habitLifecycle'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import type { HanaGameState, Quest } from '@/types'

export type ComparisonRange = 7 | 30 | 90

export type StrongestHabitSummary = {
  questId: string
  title: string
  rate: number
  settledWindows: number
}

export type ProfileComparisonSummary = {
  activeDays: number
  activeDateKeys: string[]
  settledCompleted: number
  settledMissed: number
  settledWindows: number
  settledRate: number | null
  strongestHabit: StrongestHabitSummary | null
}

export type ComparisonTrendBucket = {
  startDate: string
  endDate: string
  label: string
  hanaRate: number | null
  crambleRate: number | null
}

export type CombinedStatsResult = {
  rangeStart: string
  rangeEnd: string
  sharedActiveDays: number
  sharedActiveDateKeys: string[]
  hana: ProfileComparisonSummary
  cramble: ProfileComparisonSummary
  trend: ComparisonTrendBucket[]
}

type SettledPeriod = HabitPeriodStat & {
  questId: string
  questTitle: string
}

type ProfileCalculation = {
  summary: ProfileComparisonSummary
  settledPeriods: SettledPeriod[]
}

/**
 * Compares the two profiles using equal, resolved goal windows. A completed
 * daily habit is one window, just as a completed 10-day target is one window.
 * The newest correction days stay neutral for both people.
 */
export function getCombinedStats(
  hanaState: HanaGameState,
  hanaQuests: Quest[],
  crambleState: HanaGameState,
  crambleQuests: Quest[],
  range: ComparisonRange,
): CombinedStatsResult {
  const rangeEnd = earlierDate(hanaState.currentDate, crambleState.currentDate)
  const selectedRangeStart = addDays(rangeEnd, -(range - 1))
  const validProfileStarts = [hanaState.startDate, crambleState.startDate].filter(
    (dateKey): dateKey is string => isValidDateKey(dateKey),
  )
  const rangeStart = latestDate(selectedRangeStart, ...validProfileStarts)
  const matureThrough = addDays(rangeEnd, -(MAX_BACKFILL_DAYS + 1))

  const hana = calculateProfile(
    hanaState,
    hanaQuests,
    'hana',
    rangeStart,
    rangeEnd,
    matureThrough,
  )
  const cramble = calculateProfile(
    crambleState,
    crambleQuests,
    'cramble',
    rangeStart,
    rangeEnd,
    matureThrough,
  )
  const crambleActiveDates = new Set(cramble.summary.activeDateKeys)
  const sharedActiveDateKeys = hana.summary.activeDateKeys.filter((dateKey) =>
    crambleActiveDates.has(dateKey),
  )

  return {
    rangeStart,
    rangeEnd,
    sharedActiveDays: sharedActiveDateKeys.length,
    sharedActiveDateKeys,
    hana: hana.summary,
    cramble: cramble.summary,
    trend: buildTrend(
      range,
      rangeStart,
      rangeEnd,
      hana.settledPeriods,
      cramble.settledPeriods,
    ),
  }
}

function calculateProfile(
  sourceState: HanaGameState,
  quests: Quest[],
  profileId: HanaProfileId,
  rangeStart: string,
  rangeEnd: string,
  matureThrough: string,
): ProfileCalculation {
  const state =
    sourceState.currentDate === rangeEnd
      ? sourceState
      : { ...sourceState, currentDate: rangeEnd }
  const catalog = getQuestCatalog(quests, state)
  const periodsByHabit = catalog.map((quest) => {
    const stats = getHabitRangeStats(state, quests, profileId, quest.id, 'all')
    const settledPeriods = (stats?.periods ?? [])
      .filter(
        (period) =>
          period.endDate >= rangeStart &&
          period.endDate <= matureThrough &&
          (period.status === 'completed' || period.status === 'missed'),
      )
      .map<SettledPeriod>((period) => ({
        ...period,
        questId: quest.id,
        questTitle: quest.title,
      }))

    return { quest, settledPeriods }
  })
  const settledPeriods = periodsByHabit.flatMap(
    ({ settledPeriods: periods }) => periods,
  )
  const settledCompleted = settledPeriods.filter(
    ({ status }) => status === 'completed',
  ).length
  const settledMissed = settledPeriods.length - settledCompleted
  const activeDateKeys = getTrackedDateKeys(sourceState, rangeStart, rangeEnd)
  const strongestHabit = periodsByHabit
    .filter(({ quest }) => !isCurrentlyArchived(sourceState, quest.id))
    .map(({ quest, settledPeriods: periods }) => {
      const completed = periods.filter(
        ({ status }) => status === 'completed',
      ).length
      return {
        questId: quest.id,
        title: quest.title,
        completed,
        settledWindows: periods.length,
        rate: rate(completed, periods.length),
      }
    })
    .filter(
      (habit): habit is typeof habit & { rate: number } =>
        habit.settledWindows >= 3 && habit.completed >= 1 && habit.rate !== null,
    )
    .sort(compareHabitStrength)[0]

  return {
    summary: {
      activeDays: activeDateKeys.length,
      activeDateKeys,
      settledCompleted,
      settledMissed,
      settledWindows: settledPeriods.length,
      settledRate: rate(settledCompleted, settledPeriods.length),
      strongestHabit: strongestHabit
        ? {
            questId: strongestHabit.questId,
            title: strongestHabit.title,
            rate: strongestHabit.rate,
            settledWindows: strongestHabit.settledWindows,
          }
        : null,
    },
    settledPeriods,
  }
}

function getTrackedDateKeys(
  state: HanaGameState,
  rangeStart: string,
  rangeEnd: string,
) {
  const dates = new Set<string>()
  ;[
    state.dailyCompletions ?? {},
    state.habitOccurrences ?? {},
    state.eveningWeeds ?? {},
  ].forEach((datedRecords) => {
    Object.entries(datedRecords).forEach(([dateKey, records]) => {
      if (
        Object.keys(records).length > 0 &&
        isDateInRange(dateKey, rangeStart, rangeEnd)
      ) {
        dates.add(dateKey)
      }
    })
  })

  Object.values(state.questSkips ?? {}).forEach((skipEvents) => {
    Object.entries(skipEvents).forEach(([eventKey, isSkipped]) => {
      if (!isSkipped) return
      const dateKey = getDailySkipDate(eventKey)
      if (dateKey && isDateInRange(dateKey, rangeStart, rangeEnd)) {
        dates.add(dateKey)
      }
    })
  })

  return Array.from(dates).sort()
}

function getDailySkipDate(eventKey: string) {
  const match = /^daily:.+:(\d{4}-\d{2}-\d{2})$/.exec(eventKey)
  return match && isValidDateKey(match[1]) ? match[1] : null
}

function buildTrend(
  range: ComparisonRange,
  rangeStart: string,
  rangeEnd: string,
  hanaPeriods: SettledPeriod[],
  cramblePeriods: SettledPeriod[],
) {
  const bucketDays = range === 7 ? 1 : range === 30 ? 6 : 15
  const buckets: ComparisonTrendBucket[] = []
  let bucketStart = rangeStart

  while (bucketStart <= rangeEnd) {
    const proposedEnd = addDays(bucketStart, bucketDays - 1)
    const bucketEnd = proposedEnd < rangeEnd ? proposedEnd : rangeEnd
    buckets.push({
      startDate: bucketStart,
      endDate: bucketEnd,
      label: formatBucketLabel(bucketStart, bucketEnd),
      hanaRate: rateForBucket(hanaPeriods, bucketStart, bucketEnd),
      crambleRate: rateForBucket(cramblePeriods, bucketStart, bucketEnd),
    })
    bucketStart = addDays(bucketEnd, 1)
  }

  return buckets
}

function rateForBucket(
  periods: SettledPeriod[],
  bucketStart: string,
  bucketEnd: string,
) {
  const bucketPeriods = periods.filter(
    ({ endDate }) => endDate >= bucketStart && endDate <= bucketEnd,
  )
  const completed = bucketPeriods.filter(
    ({ status }) => status === 'completed',
  ).length
  return rate(completed, bucketPeriods.length)
}

function compareHabitStrength(
  first: {
    title: string
    completed: number
    settledWindows: number
    rate: number
  },
  second: {
    title: string
    completed: number
    settledWindows: number
    rate: number
  },
) {
  const ratioComparison =
    second.completed * first.settledWindows -
    first.completed * second.settledWindows
  return (
    ratioComparison ||
    second.settledWindows - first.settledWindows ||
    second.completed - first.completed ||
    first.title.localeCompare(second.title)
  )
}

function isCurrentlyArchived(state: HanaGameState, questId: string) {
  const archivedAt = state.habitSettings?.[questId]?.archivedAt
  return Boolean(archivedAt && archivedAt <= state.currentDate)
}

function rate(completed: number, settledWindows: number) {
  return settledWindows === 0
    ? null
    : Math.round((completed / settledWindows) * 100)
}

function isDateInRange(
  dateKey: string,
  rangeStart: string,
  rangeEnd: string,
) {
  return (
    isValidDateKey(dateKey) && dateKey >= rangeStart && dateKey <= rangeEnd
  )
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function earlierDate(first: string, second: string) {
  return first <= second ? first : second
}

function latestDate(first: string, ...rest: string[]) {
  return rest.reduce(
    (latest, candidate) => (candidate > latest ? candidate : latest),
    first,
  )
}

function formatBucketLabel(startDate: string, endDate: string) {
  if (startDate === endDate) return shortDate(startDate)
  const start = dateParts(startDate)
  const end = dateParts(endDate)
  return start.month === end.month
    ? `${start.month} ${start.day}\u2013${end.day}`
    : `${start.month} ${start.day}\u2013${end.month} ${end.day}`
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function shortDate(dateKey: string) {
  const { month, day } = dateParts(dateKey)
  return `${month} ${day}`
}

function dateParts(dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  return { month: MONTH_NAMES[month - 1], day }
}
