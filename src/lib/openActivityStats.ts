import type {
  HanaGameState,
  OpenActivity,
  OpenActivityKind,
} from '@/types'
import { getOpenActivityCatalog } from '@/lib/openActivities'
import {
  getHabitSettings,
  isHabitTrackableOnDate,
} from '@/lib/habitLifecycle'

export type OpenActivityStatsRange = 7 | 14 | 30 | 90 | 'all'

export type OpenActivityDayStat = {
  dateKey: string
  count: number
  active: boolean
}

export type OpenActivityRangeStats = {
  activity: OpenActivity
  range: OpenActivityStatsRange
  rangeStart: string
  rangeEnd: string
  days: OpenActivityDayStat[]
  total: number
  activeDays: number
  averagePerActiveDay: number
  peakCount: number
  lastLoggedDate: string | null
  todayCount: number
  weeklyPace: number
}

/**
 * Builds deadline-free activity statistics. Empty days are included for the
 * chosen visual range, but never acquire completed, missed, or streak states.
 */
export function getOpenActivityRangeStats(
  state: HanaGameState,
  activityId: string,
  range: OpenActivityStatsRange,
): OpenActivityRangeStats | null {
  const activity = getOpenActivityCatalog(state).find(
    (candidate) => candidate.id === activityId,
  )
  if (!activity || !isDateKey(state.currentDate)) return null

  const archivedAt = getHabitSettings(state, activity.id).archivedAt
  const rangeEnd =
    archivedAt && isDateKey(archivedAt) && archivedAt < state.currentDate
      ? archivedAt
      : state.currentDate
  const selectedStart =
    range === 'all'
      ? getAllTimeStart(state, activity)
      : shiftDate(rangeEnd, -(range - 1))
  const rangeStart = latestDate(
    selectedStart,
    activity.createdDate,
    state.startDate,
  )
  const days = enumerateDates(rangeStart, rangeEnd).map((dateKey) => {
    const rawCount = state.openActivityLogs?.[dateKey]?.[activity.id]
    const count = normalizeLogCount(rawCount, activity.kind)
    return { dateKey, count, active: count > 0 }
  })
  const activeDays = days.filter((day) => day.active).length
  const paceDays = days.filter(
    (day) =>
      day.active || isHabitTrackableOnDate(state, activity.id, day.dateKey),
  ).length
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const lastLoggedDate = [...days]
    .reverse()
    .find((day) => day.active)?.dateKey ?? null

  return {
    activity,
    range,
    rangeStart,
    rangeEnd,
    days,
    total,
    activeDays,
    averagePerActiveDay: activeDays ? total / activeDays : 0,
    peakCount: days.reduce((peak, day) => Math.max(peak, day.count), 0),
    lastLoggedDate,
    todayCount: days.at(-1)?.count ?? 0,
    weeklyPace: paceDays ? (total / paceDays) * 7 : 0,
  }
}

export function getOpenActivityAllTimeStats(
  state: HanaGameState,
  activityId: string,
) {
  return getOpenActivityRangeStats(state, activityId, 'all')
}

export function normalizeLogCount(
  value: unknown,
  kind: OpenActivityKind,
) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (kind === 'check') return 1
  return Math.floor(value)
}

function getAllTimeStart(state: HanaGameState, activity: OpenActivity) {
  return latestDate(activity.createdDate, state.startDate)
}

function latestDate(...values: Array<string | null | undefined>) {
  return values
    .filter((dateKey): dateKey is string => Boolean(dateKey && isDateKey(dateKey)))
    .sort()
    .at(-1) ?? values.find((value): value is string => Boolean(value)) ?? ''
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    dates.push(cursor)
    cursor = shiftDate(cursor, 1)
  }
  return dates
}

function shiftDate(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}
