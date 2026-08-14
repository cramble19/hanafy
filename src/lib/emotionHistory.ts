import { addDays } from '@/lib/hanaGame'
import type { DailyEmotion, GameState } from '@/types'

export type EmotionHistoryRange = 7 | 30 | 90

export type CombinedEmotionRange = 7 | 30

export type EmotionHistoryDay = {
  dateKey: string
  emotion: DailyEmotion | null
}

export type EmotionHistoryStats = {
  range: EmotionHistoryRange
  startDate: string
  endDate: string
  days: EmotionHistoryDay[]
  recordedDays: number
  mostCommon: DailyEmotion | null
  current: DailyEmotion | null
}

export type CombinedEmotionDay = {
  dateKey: string
  hanaEmotion: DailyEmotion | null
  crambleEmotion: DailyEmotion | null
}

export type CombinedEmotionStats = {
  range: CombinedEmotionRange
  startDate: string
  endDate: string
  days: CombinedEmotionDay[]
}

export const EMOTIONS_BEST_FIRST: DailyEmotion[] = [
  'bright',
  'good',
  'okay',
  'low',
  'heavy',
]

export function getEmotionHistoryStats(
  state: GameState,
  range: EmotionHistoryRange,
): EmotionHistoryStats {
  const selectedStart = addDays(state.currentDate, -(range - 1))
  const startDate = state.startDate && state.startDate > selectedStart
    ? state.startDate
    : selectedStart
  const days: EmotionHistoryDay[] = []

  for (let dateKey = startDate; dateKey <= state.currentDate; dateKey = addDays(dateKey, 1)) {
    days.push({
      dateKey,
      emotion: state.dailyEmotions?.[dateKey] ?? null,
    })
  }

  const recorded = days.filter(
    (day): day is EmotionHistoryDay & { emotion: DailyEmotion } =>
      day.emotion !== null,
  )

  return {
    range,
    startDate,
    endDate: state.currentDate,
    days,
    recordedDays: recorded.length,
    mostCommon: getMostCommonEmotion(recorded),
    current: state.dailyEmotions?.[state.currentDate] ?? null,
  }
}

/**
 * Builds one complete shared logical-day axis for Hana and Cramble. The
 * comparison ends on the earlier profile date, always spans the selected
 * number of calendar days, and keeps pre-start or absent records neutral.
 */
export function getCombinedEmotionStats(
  hanaState: GameState,
  crambleState: GameState,
  range: CombinedEmotionRange,
): CombinedEmotionStats {
  const endDate =
    hanaState.currentDate <= crambleState.currentDate
      ? hanaState.currentDate
      : crambleState.currentDate
  const startDate = addDays(endDate, -(range - 1))
  const days: CombinedEmotionDay[] = []

  for (let dateKey = startDate; dateKey <= endDate; dateKey = addDays(dateKey, 1)) {
    days.push({
      dateKey,
      hanaEmotion: getProfileEmotion(hanaState, dateKey),
      crambleEmotion: getProfileEmotion(crambleState, dateKey),
    })
  }

  return { range, startDate, endDate, days }
}

function getProfileEmotion(state: GameState, dateKey: string) {
  if (state.startDate && dateKey < state.startDate) return null
  return state.dailyEmotions?.[dateKey] ?? null
}

/** Consecutive runs prevent a line from implying data on unrecorded days. */
export function getEmotionTimelineRuns(days: EmotionHistoryDay[]) {
  return days.reduce<Array<Array<EmotionHistoryDay & { emotion: DailyEmotion }>>>(
    (runs, day, index) => {
      if (!day.emotion) return runs
      const previousDay = days[index - 1]
      const lastRun = runs.at(-1)
      if (lastRun && previousDay?.emotion) {
        lastRun.push({ ...day, emotion: day.emotion })
      } else {
        runs.push([{ ...day, emotion: day.emotion }])
      }
      return runs
    },
    [],
  )
}

function getMostCommonEmotion(
  days: Array<EmotionHistoryDay & { emotion: DailyEmotion }>,
) {
  if (!days.length) return null
  const counts = new Map<DailyEmotion, number>()
  const mostRecentIndex = new Map<DailyEmotion, number>()
  days.forEach((day, index) => {
    counts.set(day.emotion, (counts.get(day.emotion) ?? 0) + 1)
    mostRecentIndex.set(day.emotion, index)
  })

  return [...counts.keys()].sort((first, second) => {
    const countDifference = (counts.get(second) ?? 0) - (counts.get(first) ?? 0)
    if (countDifference) return countDifference
    return (mostRecentIndex.get(second) ?? 0) - (mostRecentIndex.get(first) ?? 0)
  })[0]
}
