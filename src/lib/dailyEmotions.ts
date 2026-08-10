import type { DailyEmotion, GameState } from '@/types'

export const DAILY_EMOTIONS: DailyEmotion[] = [
  'heavy',
  'low',
  'okay',
  'good',
  'bright',
]

export const DAILY_EMOTION_LABELS: Record<DailyEmotion, string> = {
  heavy: 'Heavy',
  low: 'Low',
  okay: 'Okay',
  good: 'Good',
  bright: 'Bright',
}

export function getDailyEmotion(
  state: GameState,
  dateKey = state.currentDate,
) {
  return state.dailyEmotions?.[dateKey] ?? null
}

export function setDailyEmotion(
  state: GameState,
  emotion: DailyEmotion,
): GameState {
  if (!DAILY_EMOTIONS.includes(emotion)) return state
  if (state.dailyEmotions?.[state.currentDate] === emotion) return state
  return {
    ...state,
    dailyEmotions: {
      ...(state.dailyEmotions ?? {}),
      [state.currentDate]: emotion,
    },
  }
}

export function normalizeDailyEmotions(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.entries(value).reduce<Record<string, DailyEmotion>>(
    (result, [dateKey, emotion]) => {
      if (isDateKey(dateKey) && isDailyEmotion(emotion)) {
        result[dateKey] = emotion
      }
      return result
    },
    {},
  )
}

function isDailyEmotion(value: unknown): value is DailyEmotion {
  return typeof value === 'string' &&
    DAILY_EMOTIONS.includes(value as DailyEmotion)
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
