import type {
  GameState,
  HabitCompletionState,
  HabitSettings,
  PauseReason,
  TrackingPause,
} from '@/types'

export const GAME_STATE_SCHEMA_VERSION = 4 as const
export const MAX_BACKFILL_DAYS = 3

export const PAUSE_REASON_OPTIONS: Array<{
  value: PauseReason
  label: string
  description: string
}> = [
  { value: 'rest', label: 'Rest or recovery', description: 'A planned lighter stretch.' },
  { value: 'illness', label: 'Sick', description: 'Health needs the space today.' },
  { value: 'period', label: 'Period', description: 'Make room for your cycle.' },
  { value: 'vacation', label: 'Vacation', description: 'Step away without creating debt.' },
  { value: 'travel', label: 'Travel', description: 'Your normal cues are unavailable.' },
  { value: 'overwhelmed', label: 'Life feels full', description: 'Reduce pressure for a while.' },
  { value: 'scheduleChange', label: 'Schedule changed', description: 'The old routine does not fit.' },
  { value: 'other', label: 'Something else', description: 'Use a neutral label without extra detail.' },
]

export function createDefaultHabitSettings(): HabitSettings {
  return {
    cue: '',
    reminder: { enabled: false, time: null },
    archivedAt: null,
    pauses: [],
    completion: createDefaultHabitCompletionState(),
  }
}

export function createDefaultHabitCompletionState(): HabitCompletionState {
  return {
    cycleStartedOn: null,
    graduation: null,
    history: [],
  }
}

export function getHabitSettings(
  state: GameState,
  habitId: string,
): HabitSettings & { completion: HabitCompletionState } {
  const defaults = createDefaultHabitSettings()
  const defaultCompletion = createDefaultHabitCompletionState()
  const stored = state.habitSettings?.[habitId]
  if (!stored) {
    return { ...defaults, completion: defaultCompletion }
  }
  const storedCompletion = stored.completion
  return {
    ...defaults,
    ...stored,
    reminder: { ...defaults.reminder, ...(stored.reminder ?? {}) },
    pauses: stored.pauses ?? [],
    completion: {
      cycleStartedOn: storedCompletion?.cycleStartedOn ?? null,
      graduation: storedCompletion?.graduation ?? null,
      history: storedCompletion?.history ?? [],
    },
  }
}

export function isPauseActiveOnDate(pause: TrackingPause, dateKey: string) {
  return pause.startDate <= dateKey && (!pause.endDate || dateKey <= pause.endDate)
}

export function getActiveProfilePause(
  state: GameState,
  dateKey = state.currentDate,
) {
  return [...(state.trackingPauses ?? [])]
    .reverse()
    .find((pause) => isPauseActiveOnDate(pause, dateKey)) ?? null
}

export function getActiveHabitPause(
  state: GameState,
  habitId: string,
  dateKey = state.currentDate,
) {
  return [...getHabitSettings(state, habitId).pauses]
    .reverse()
    .find((pause) => isPauseActiveOnDate(pause, dateKey)) ?? null
}

export function isHabitPausedOnDate(
  state: GameState,
  habitId: string,
  dateKey = state.currentDate,
) {
  return Boolean(
    getActiveProfilePause(state, dateKey) ||
      getActiveHabitPause(state, habitId, dateKey),
  )
}

export function isHabitArchivedOnDate(
  state: GameState,
  habitId: string,
  dateKey = state.currentDate,
) {
  const archivedAt = getHabitSettings(state, habitId).archivedAt
  return Boolean(archivedAt && archivedAt <= dateKey)
}

export function isHabitGraduatedOnDate(
  state: GameState,
  habitId: string,
  dateKey = state.currentDate,
) {
  const graduation = getHabitSettings(state, habitId).completion.graduation
  return Boolean(graduation && graduation.effectiveDate <= dateKey)
}

export function isHabitTrackableOnDate(
  state: GameState,
  habitId: string,
  dateKey = state.currentDate,
) {
  return (
    !isHabitArchivedOnDate(state, habitId, dateKey) &&
    !isHabitGraduatedOnDate(state, habitId, dateKey) &&
    !isHabitPausedOnDate(state, habitId, dateKey)
  )
}

export type PauseInput = {
  reason: PauseReason
  note?: string
  endDate?: string | null
}

export function startProfilePause(state: GameState, input: PauseInput): GameState {
  if (getActiveProfilePause(state)) return state
  return {
    ...state,
    trackingPauses: [
      ...(state.trackingPauses ?? []),
      createPause(state.currentDate, input),
    ],
  }
}

export function resumeProfileTracking(state: GameState): GameState {
  const active = getActiveProfilePause(state)
  if (!active) return state
  return {
    ...state,
    trackingPauses: endOrRemovePause(
      state.trackingPauses ?? [],
      active.id,
      state.currentDate,
    ),
  }
}

export function startHabitPause(
  state: GameState,
  habitId: string,
  input: PauseInput,
): GameState {
  if (getActiveHabitPause(state, habitId)) return state
  const settings = getHabitSettings(state, habitId)
  return setHabitSettings(state, habitId, {
    ...settings,
    pauses: [...settings.pauses, createPause(state.currentDate, input)],
  })
}

export function resumeHabitTracking(state: GameState, habitId: string): GameState {
  const active = getActiveHabitPause(state, habitId)
  if (!active) return state
  const settings = getHabitSettings(state, habitId)
  return setHabitSettings(state, habitId, {
    ...settings,
    pauses: endOrRemovePause(settings.pauses, active.id, state.currentDate),
  })
}

export function archiveHabit(state: GameState, habitId: string): GameState {
  const settings = getHabitSettings(state, habitId)
  const activePause = getActiveHabitPause(state, habitId)
  return setHabitSettings(state, habitId, {
    ...settings,
    archivedAt: state.currentDate,
    pauses: activePause
      ? endOrRemovePause(settings.pauses, activePause.id, state.currentDate)
      : settings.pauses,
  })
}

export function restoreHabit(state: GameState, habitId: string): GameState {
  const settings = getHabitSettings(state, habitId)
  const archiveInterval =
    settings.archivedAt && settings.archivedAt < state.currentDate
      ? createPause(settings.archivedAt, {
          reason: 'scheduleChange',
          note: 'Archived',
          endDate: shiftDateKey(state.currentDate, -1),
        })
      : null
  return setHabitSettings(state, habitId, {
    ...settings,
    archivedAt: null,
    pauses: archiveInterval
      ? [...settings.pauses, archiveInterval]
      : settings.pauses,
  })
}

export function restoreGraduatedHabit(
  state: GameState,
  habitId: string,
): GameState {
  const settings = getHabitSettings(state, habitId)
  const graduation = settings.completion.graduation
  if (!graduation || graduation.effectiveDate > state.currentDate) return state

  return setHabitSettings(state, habitId, {
    ...settings,
    completion: {
      cycleStartedOn: state.currentDate,
      graduation: null,
      history: [...settings.completion.history, graduation].slice(-50),
    },
  })
}

export function updateHabitPreferences(
  state: GameState,
  habitId: string,
  input: { cue: string; reminderTime: string | null },
): GameState {
  const settings = getHabitSettings(state, habitId)
  return setHabitSettings(state, habitId, {
    ...settings,
    cue: input.cue.trim().slice(0, 100),
    reminder: {
      enabled: Boolean(input.reminderTime),
      time: input.reminderTime,
    },
  })
}

export function updateHabitWording(
  state: GameState,
  habitId: string,
  input: { title: string; description: string },
): GameState {
  const settings = getHabitSettings(state, habitId)
  return setHabitSettings(state, habitId, {
    ...settings,
    titleOverride: input.title.trim().slice(0, 80),
    descriptionOverride: input.description.trim().slice(0, 280),
  })
}

export function hasHabitHistory(state: GameState, habitId: string) {
  if (
    Object.values(state.openActivityLogs ?? {}).some(
      (records) => (records[habitId] ?? 0) > 0,
    ) ||
    Object.values(state.dailyCompletions ?? {}).some(
      (records) => records[habitId] === true,
    ) ||
    Object.values(state.habitOccurrences ?? {}).some(
      (records) => (records[habitId] ?? 0) > 0,
    ) ||
    Object.values(state.longTermCompletions?.[habitId] ?? {}).some(Boolean)
  ) {
    return true
  }

  if (
    Object.entries(state.activeDailyQuests ?? {}).some(
      ([dateKey, ids]) => dateKey < state.currentDate && ids.includes(habitId),
    )
  ) {
    return true
  }

  return Object.values(state.questSkips ?? {}).some((skips) =>
    Object.entries(skips).some(
      ([key, skipped]) => skipped && key.includes(`:${habitId}:`),
    ),
  )
}

/**
 * Permanently removes a habit and every identifying progress record. Built-in
 * definitions receive a persisted tombstone so their source definition cannot
 * make them reappear after a reload. The caller must recompute rewards with the
 * remaining catalog afterwards.
 */
export function deleteHabitPermanently(
  state: GameState,
  habitId: string,
): GameState {
  const isCustom = state.customHabits.some((habit) => habit.id === habitId)
  const isOpenActivity = (state.openActivities ?? []).some(
    (activity) => activity.id === habitId,
  )
  const isAlreadyDeleted = state.deletedHabitIds?.includes(habitId) ?? false
  if (!isCustom && !isOpenActivity && isAlreadyDeleted) return state

  const habitSettings = { ...(state.habitSettings ?? {}) }
  delete habitSettings[habitId]
  const questActivations = { ...(state.questActivations ?? {}) }
  delete questActivations[habitId]
  const longTermWindows = { ...state.longTermWindows }
  delete longTermWindows[habitId]
  const longTermCompletions = { ...state.longTermCompletions }
  delete longTermCompletions[habitId]

  return {
    ...state,
    customHabits: state.customHabits.filter((habit) => habit.id !== habitId),
    openActivities: (state.openActivities ?? []).filter(
      (activity) => activity.id !== habitId,
    ),
    openActivityLogs: omitRecordKey(state.openActivityLogs ?? {}, habitId),
    deletedHabitIds: Array.from(
      new Set([...(state.deletedHabitIds ?? []), habitId]),
    ),
    habitSettings,
    questActivations,
    activeDailyQuests: mapArrayRecord(state.activeDailyQuests, (ids) =>
      ids.filter((id) => id !== habitId),
    ),
    activeLongTermQuestIds: state.activeLongTermQuestIds.filter(
      (id) => id !== habitId,
    ),
    dailyCompletions: omitRecordKey(state.dailyCompletions, habitId),
    habitOccurrences: omitRecordKey(state.habitOccurrences, habitId),
    longTermWindows,
    longTermCompletions,
    questSkips: mapBooleanRecord(state.questSkips, (key) =>
      !key.includes(`:${habitId}:`),
    ),
    backfillAudit: (state.backfillAudit ?? []).filter(
      (event) => event.habitId !== habitId,
    ),
  }
}

/** @deprecated Use deleteHabitPermanently for built-in and custom habits. */
export const purgeCustomHabit = deleteHabitPermanently

function setHabitSettings(
  state: GameState,
  habitId: string,
  settings: HabitSettings,
): GameState {
  return {
    ...state,
    habitSettings: {
      ...(state.habitSettings ?? {}),
      [habitId]: settings,
    },
  }
}

function createPause(startDate: string, input: PauseInput): TrackingPause {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return {
    id: `pause-${randomId}`,
    startDate,
    endDate:
      input.endDate && input.endDate >= startDate ? input.endDate : null,
    reason: input.reason,
    note: input.note?.trim().slice(0, 120) || undefined,
    recordedAt: new Date().toISOString(),
  }
}

function endOrRemovePause(
  pauses: TrackingPause[],
  pauseId: string,
  resumeDate: string,
) {
  const target = pauses.find((pause) => pause.id === pauseId)
  if (!target) return pauses
  if (target.startDate === resumeDate) {
    return pauses.filter((pause) => pause.id !== pauseId)
  }
  const previousDate = shiftDateKey(resumeDate, -1)
  return pauses.map((pause) =>
    pause.id === pauseId ? { ...pause, endDate: previousDate } : pause,
  )
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function mapArrayRecord(
  record: Record<string, string[]>,
  map: (value: string[]) => string[],
) {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([key, value]) => [key, map(value)]),
  )
}

function omitRecordKey<T>(record: Record<string, Record<string, T>>, key: string) {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([dateKey, values]) => {
      const next = { ...values }
      delete next[key]
      return [dateKey, next]
    }),
  )
}

function mapBooleanRecord(
  record: Record<string, Record<string, boolean>>,
  keep: (key: string) => boolean,
) {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([periodKey, values]) => [
      periodKey,
      Object.fromEntries(Object.entries(values).filter(([key]) => keep(key))),
    ]),
  )
}
