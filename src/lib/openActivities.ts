import {
  deleteHabitPermanently,
  isHabitArchivedOnDate,
  isHabitTrackableOnDate,
  MAX_BACKFILL_DAYS,
} from '@/lib/habitLifecycle'
import type {
  GameState,
  HabitBackfillEvent,
  NewOpenActivityInput,
  OpenActivity,
} from '@/types'
import { getDefaultEmoji } from '@/lib/emojiLibrary'

export type OpenActivityProfile = 'hana' | 'cramble'

export type OpenActivityLogEntry = {
  dateKey: string
  value: number
}

export type OpenActivitySummary = {
  total: number
  activeDays: number
  averagePerActiveDay: number
  lastLoggedDate: string | null
}

export const OPEN_ACTIVITY_LIMITS = {
  definitions: 500,
  title: 60,
  description: 180,
  unit: 24,
  emoji: 8,
  /** Practical per-day ceiling that protects exports and chart scales. */
  dailyCount: 999_999,
} as const

export function getNewOpenActivityValidationError(
  input: NewOpenActivityInput,
  existingTitles: string[] = [],
) {
  const title = input.title.trim()
  const description = input.description.trim()
  if (!title) return 'Give this log a name.'
  if (title.length > OPEN_ACTIVITY_LIMITS.title) {
    return `Keep the name within ${OPEN_ACTIVITY_LIMITS.title} characters.`
  }
  if (!description) return 'Add a short description of what you will record.'
  if (description.length > OPEN_ACTIVITY_LIMITS.description) {
    return `Keep the description within ${OPEN_ACTIVITY_LIMITS.description} characters.`
  }
  if (input.kind !== 'check' && input.kind !== 'count') {
    return 'Choose Done today or Number.'
  }
  if ((input.unit?.trim().length ?? 0) > OPEN_ACTIVITY_LIMITS.unit) {
    return `Keep the unit within ${OPEN_ACTIVITY_LIMITS.unit} characters.`
  }
  if ((input.emoji?.trim().length ?? 0) > OPEN_ACTIVITY_LIMITS.emoji) {
    return 'Choose a shorter symbol.'
  }
  if (input.color && !/^#[0-9a-f]{6}$/i.test(input.color.trim())) {
    return 'Choose a valid activity color.'
  }
  if (
    existingTitles.some(
      (existingTitle) =>
        existingTitle.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
  ) {
    return 'An anytime log with this name already exists in this profile.'
  }
  return null
}

export function createOpenActivity(
  input: NewOpenActivityInput,
  profile: OpenActivityProfile,
  createdDate: string,
  existingTitles: string[] = [],
  id = createOpenActivityId(profile),
): OpenActivity {
  const validationError = getNewOpenActivityValidationError(
    input,
    existingTitles,
  )
  if (validationError) throw new Error(validationError)
  if (!isDateKey(createdDate)) throw new Error('Choose a valid creation date.')
  if (!isValidOpenActivityId(id)) throw new Error('Choose a valid activity id.')

  return {
    id,
    custom: true,
    title: input.title.trim(),
    description: input.description.trim(),
    emoji: input.emoji?.trim() || getDefaultEmoji(profile),
    color: input.color?.trim() || getDefaultOpenActivityColor(profile, input.kind),
    kind: input.kind,
    unit: input.kind === 'count' ? input.unit?.trim() || null : null,
    createdDate,
  }
}

export function updateOpenActivityDefinition(
  activity: OpenActivity,
  input: NewOpenActivityInput,
  existingTitles: string[] = [],
): OpenActivity {
  const validationError = getNewOpenActivityValidationError(
    input,
    existingTitles,
  )
  if (validationError) throw new Error(validationError)

  return {
    ...activity,
    title: input.title.trim(),
    description: input.description.trim(),
    emoji: input.emoji?.trim() || activity.emoji,
    color: input.color?.trim() || activity.color,
    kind: input.kind,
    unit: input.kind === 'count' ? input.unit?.trim() || null : null,
  }
}

/** Applies the same wording overrides used by scheduled habits. */
export function getOpenActivityCatalog(state: GameState) {
  return (state.openActivities ?? []).map((activity) => {
    const settings = state.habitSettings?.[activity.id]
    return {
      ...activity,
      title: settings?.titleOverride || activity.title,
      description: settings?.descriptionOverride || activity.description,
    }
  })
}

/** Archived definitions stay persisted, but are omitted from the Today list. */
export function getActiveOpenActivities(
  state: GameState,
  dateKey = state.currentDate,
) {
  return getOpenActivityCatalog(state).filter(
    (activity) =>
      activity.createdDate <= dateKey &&
      !isHabitArchivedOnDate(state, activity.id, dateKey),
  )
}

export function getOpenActivityValue(
  state: GameState,
  activityId: string,
  dateKey = state.currentDate,
) {
  return state.openActivityLogs?.[dateKey]?.[activityId] ?? 0
}

/**
 * Records against the state's logical day, so callers inherit Hanafy's 04:00
 * boundary. Paused and archived activities are intentionally immutable.
 */
export function setOpenActivityValue(
  state: GameState,
  activityId: string,
  value: number,
): GameState {
  return setOpenActivityValueForDate(
    state,
    activityId,
    state.currentDate,
    value,
  )
}

export function getOpenActivityDateValidationError(
  state: GameState,
  activityId: string,
  dateKey: string,
) {
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (!activity) return 'This anytime log no longer exists.'
  if (!isDateKey(dateKey)) return 'Choose a valid tracking day.'
  if (dateKey > state.currentDate) return 'Future days cannot be recorded.'
  if (state.startDate && dateKey < state.startDate) {
    return 'Choose a day after this tracker began.'
  }
  if (dateKey < activity.createdDate) {
    return 'Choose a day after this anytime log was created.'
  }
  if (dateDiffDays(dateKey, state.currentDate) > MAX_BACKFILL_DAYS) {
    return `Only the previous ${MAX_BACKFILL_DAYS} days can be corrected.`
  }
  if (!isHabitTrackableOnDate(state, activityId, dateKey)) {
    return 'This anytime log was neutral on that day.'
  }
  return null
}

export function setOpenActivityValueForDate(
  state: GameState,
  activityId: string,
  dateKey: string,
  value: number,
): GameState {
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (
    !activity ||
    getOpenActivityDateValidationError(state, activityId, dateKey) ||
    !isValidOpenActivityValue(activity, value)
  ) return state

  const logs = state.openActivityLogs ?? {}
  const currentLogs = logs[dateKey] ?? {}
  const currentValue = currentLogs[activityId] ?? 0
  if (currentValue === value) return state

  const nextCurrentLogs = { ...currentLogs }
  if (value === 0) {
    delete nextCurrentLogs[activityId]
  } else {
    nextCurrentLogs[activityId] = value
  }

  const nextLogs = { ...logs }
  if (Object.keys(nextCurrentLogs).length === 0) {
    delete nextLogs[dateKey]
  } else {
    nextLogs[dateKey] = nextCurrentLogs
  }

  return {
    ...state,
    openActivityLogs: nextLogs,
  }
}

export function toggleOpenActivityCheck(
  state: GameState,
  activityId: string,
) {
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (activity?.kind !== 'check') return state
  return setOpenActivityValue(
    state,
    activityId,
    getOpenActivityValue(state, activityId) === 1 ? 0 : 1,
  )
}

export function incrementOpenActivityCount(
  state: GameState,
  activityId: string,
  delta: number,
) {
  return incrementOpenActivityCountForDate(
    state,
    activityId,
    state.currentDate,
    delta,
  )
}

export function incrementOpenActivityCountForDate(
  state: GameState,
  activityId: string,
  dateKey: string,
  delta: number,
) {
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (activity?.kind !== 'count' || !Number.isSafeInteger(delta)) return state

  const nextValue = getOpenActivityValue(state, activityId, dateKey) + delta
  if (
    !Number.isSafeInteger(nextValue) ||
    nextValue < 0 ||
    nextValue > OPEN_ACTIVITY_LIMITS.dailyCount
  ) return state
  return setOpenActivityValueForDate(state, activityId, dateKey, nextValue)
}

/** Records one recent-day value and preserves when that correction was entered. */
export function recordOpenActivityForDate(
  state: GameState,
  activityId: string,
  dateKey: string,
): { state: GameState; error: string | null } {
  const error = getOpenActivityDateValidationError(state, activityId, dateKey)
  if (error) return { state, error }
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (!activity) return { state, error: 'That anytime log is unavailable.' }

  const nextState = activity.kind === 'check'
    ? setOpenActivityValueForDate(state, activityId, dateKey, 1)
    : activity.kind === 'count'
      ? incrementOpenActivityCountForDate(state, activityId, dateKey, 1)
      : state
  if (nextState === state) {
    return {
      state,
      error:
        activity.kind === 'check'
          ? 'This activity is already logged for that day.'
          : activity.kind === 'count'
            ? 'That daily count cannot be increased further.'
            : 'Ratings can only be entered from Today.',
    }
  }

  return {
    state: appendOpenActivityAudit(nextState, activityId, dateKey, 1),
    error: null,
  }
}

/** Removes one recent-day value and keeps the correction provenance. */
export function undoOpenActivityForDate(
  state: GameState,
  activityId: string,
  dateKey: string,
): { state: GameState; error: string | null } {
  const error = getOpenActivityDateValidationError(state, activityId, dateKey)
  if (error) return { state, error }
  const activity = (state.openActivities ?? []).find(
    (candidate) => candidate.id === activityId,
  )
  if (!activity) return { state, error: 'That anytime log is unavailable.' }
  if (getOpenActivityValue(state, activityId, dateKey) <= 0) {
    return { state, error: 'There is no activity log to undo on that day.' }
  }

  const nextState = activity.kind === 'check' || activity.kind === 'rating'
    ? setOpenActivityValueForDate(state, activityId, dateKey, 0)
    : incrementOpenActivityCountForDate(state, activityId, dateKey, -1)
  if (nextState === state) {
    return { state, error: 'Could not undo that activity log.' }
  }

  return {
    state: appendOpenActivityAudit(nextState, activityId, dateKey, -1),
    error: null,
  }
}

export function hasOpenActivityHistory(
  state: GameState,
  activityId: string,
) {
  return Object.values(state.openActivityLogs ?? {}).some(
    (logs) => (logs[activityId] ?? 0) > 0,
  )
}

/** Removes the definition, its complete history, and lifecycle preferences. */
export function deleteOpenActivityPermanently(
  state: GameState,
  activityId: string,
): GameState {
  if (!(state.openActivities ?? []).some((item) => item.id === activityId)) {
    return state
  }
  return deleteHabitPermanently(state, activityId)
}

export function getOpenActivityLogEntries(
  state: GameState,
  activityId: string,
  range: { startDate?: string; endDate?: string } = {},
) {
  return Object.entries(state.openActivityLogs ?? {})
    .filter(
      ([dateKey, logs]) =>
        (!range.startDate || dateKey >= range.startDate) &&
        (!range.endDate || dateKey <= range.endDate) &&
        (logs[activityId] ?? 0) > 0,
    )
    .map<OpenActivityLogEntry>(([dateKey, logs]) => ({
      dateKey,
      value: logs[activityId],
    }))
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
}

export function getOpenActivitySummary(
  state: GameState,
  activityId: string,
  range: { startDate?: string; endDate?: string } = {},
): OpenActivitySummary {
  const entries = getOpenActivityLogEntries(state, activityId, range)
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  return {
    total,
    activeDays: entries.length,
    averagePerActiveDay: entries.length > 0 ? total / entries.length : 0,
    lastLoggedDate: entries.at(-1)?.dateKey ?? null,
  }
}

/** Runtime sanitizer used when loading local or database snapshots. */
export function normalizeOpenActivities(
  value: unknown,
  reservedIds: Iterable<string> = [],
) {
  if (!Array.isArray(value)) return []
  const seenIds = new Set(reservedIds)
  const seenTitles = new Set<string>()

  return value.slice(-OPEN_ACTIVITY_LIMITS.definitions).reduce<OpenActivity[]>(
    (result, item) => {
      const activity = readOpenActivity(item)
      if (!activity) return result
      const titleKey = activity.title.toLocaleLowerCase()
      if (seenIds.has(activity.id) || seenTitles.has(titleKey)) return result
      seenIds.add(activity.id)
      seenTitles.add(titleKey)
      result.push(activity)
      return result
    },
    [],
  )
}

/**
 * Keeps only logs belonging to valid definitions and enforces each definition's
 * binary/count invariant. Zero is represented by the absence of a stored row.
 */
export function normalizeOpenActivityLogs(
  value: unknown,
  activities: OpenActivity[],
) {
  if (!isRecord(value)) return {}
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))

  return Object.entries(value).reduce<Record<string, Record<string, number>>>(
    (result, [dateKey, logs]) => {
      if (!isDateKey(dateKey) || !isRecord(logs)) return result
      const validLogs = Object.entries(logs).reduce<Record<string, number>>(
        (dateResult, [activityId, count]) => {
          const activity = activityById.get(activityId)
          const normalizedValue = activity
            ? normalizeStoredOpenActivityValue(activity, count)
            : 0
          if (
            activity &&
            dateKey >= activity.createdDate &&
            normalizedValue > 0
          ) {
            dateResult[activityId] = normalizedValue
          }
          return dateResult
        },
        {},
      )
      if (Object.keys(validLogs).length > 0) result[dateKey] = validLogs
      return result
    },
    {},
  )
}

function readOpenActivity(value: unknown): OpenActivity | null {
  if (!isRecord(value)) return null
  const id = readTrimmedString(value.id, 120)
  const title = readTrimmedString(value.title, OPEN_ACTIVITY_LIMITS.title)
  const description = readTrimmedString(
    value.description,
    OPEN_ACTIVITY_LIMITS.description,
  )
  const emoji = readTrimmedString(value.emoji, OPEN_ACTIVITY_LIMITS.emoji)
  const color = readTrimmedString(value.color, 7)
  const createdDate = isDateKey(value.createdDate) ? value.createdDate : null
  const kind =
    value.kind === 'check' ||
    value.kind === 'count' ||
    value.kind === 'rating'
      ? value.kind
      : null
  const unit = value.unit === null
    ? null
    : readTrimmedString(value.unit, OPEN_ACTIVITY_LIMITS.unit)

  if (
    !id ||
    !isValidOpenActivityId(id) ||
    value.custom !== true ||
    !title ||
    !description ||
    !emoji ||
    !color?.match(/^#[0-9a-f]{6}$/i) ||
    !createdDate ||
    !kind
  ) {
    return null
  }

  return {
    id,
    custom: true,
    title,
    description,
    emoji,
    color,
    kind,
    unit: kind === 'count' ? unit : null,
    createdDate,
  }
}

function isValidOpenActivityValue(activity: OpenActivity, value: number) {
  return Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= (
      activity.kind === 'count'
        ? OPEN_ACTIVITY_LIMITS.dailyCount
        : activity.kind === 'rating'
          ? 5
          : 1
    )
}

function normalizeStoredOpenActivityValue(
  activity: OpenActivity,
  value: unknown,
) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return 0
  }
  if (activity.kind === 'rating') return Math.min(5, value)
  return isValidOpenActivityValue(activity, value) ? value : 0
}

function createOpenActivityId(profile: OpenActivityProfile) {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `open-${profile}-${randomId}`
}

function appendOpenActivityAudit(
  state: GameState,
  activityId: string,
  performedDate: string,
  delta: HabitBackfillEvent['delta'],
) {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const event: HabitBackfillEvent = {
    id: `backfill-${randomId}`,
    habitId: activityId,
    performedDate,
    recordedAt: new Date().toISOString(),
    delta,
  }
  return {
    ...state,
    backfillAudit: [...(state.backfillAudit ?? []), event],
  }
}

function isValidOpenActivityId(value: string) {
  return (
    (value.startsWith('open-') || value.startsWith('custom-hana-')) &&
    value.length <= 120 &&
    !value.includes(':')
  )
}

function getDefaultOpenActivityColor(
  profile: OpenActivityProfile,
  kind: OpenActivity['kind'],
) {
  if (profile === 'hana') return kind === 'check' ? '#e7a8ad' : '#9fb683'
  return kind === 'check' ? '#d6a653' : '#8baebb'
}

function readTrimmedString(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maximumLength ? trimmed : null
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
}

function dateDiffDays(fromDateKey: string, toDateKey: string) {
  const [fromYear, fromMonth, fromDay] = fromDateKey.split('-').map(Number)
  const [toYear, toMonth, toDay] = toDateKey.split('-').map(Number)
  const from = new Date(fromYear, fromMonth - 1, fromDay, 12)
  const to = new Date(toYear, toMonth - 1, toDay, 12)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
