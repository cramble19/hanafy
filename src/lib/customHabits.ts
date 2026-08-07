import type { CustomHabitQuest, Difficulty, Quest, QuestSchedule } from '@/types'
import { PERIOD_TARGET_LIMITS } from '@/lib/hanaGame'

export type HabitProfile = 'hana' | 'cramble'
export type HabitFrequency = 'oncePerPeriod' | 'timesPerPeriod'
export type HabitPeriodUnit = 'days' | 'weeks'
export type HabitPeriodPreset = 'daily' | 'weekly' | 'custom'

export type NewHabitInput = {
  title: string
  description: string
  frequency: HabitFrequency
  target: number
  periodLength: number
  periodUnit: HabitPeriodUnit
  difficulty: Difficulty
  cue?: string
  reminderTime?: string | null
}

export const CUSTOM_HABIT_LIMITS = {
  title: 60,
  description: 180,
  target: PERIOD_TARGET_LIMITS.target,
  periodDays: PERIOD_TARGET_LIMITS.periodDays,
  periodWeeks: 52,
  cue: 100,
} as const

export function resolveHabitPeriodPreset(
  preset: HabitPeriodPreset,
  customDays: number,
): Pick<NewHabitInput, 'periodLength' | 'periodUnit'> {
  if (preset === 'daily') {
    return { periodLength: 1, periodUnit: 'days' }
  }
  if (preset === 'weekly') {
    return { periodLength: 1, periodUnit: 'weeks' }
  }
  return { periodLength: customDays, periodUnit: 'days' }
}

export function getNewHabitValidationError(
  input: NewHabitInput,
  existingTitles: string[] = [],
) {
  const title = input.title.trim()
  const description = input.description.trim()
  if (!title) return 'Give this habit a name.'
  if (title.length > CUSTOM_HABIT_LIMITS.title) {
    return `Keep the name within ${CUSTOM_HABIT_LIMITS.title} characters.`
  }
  if (!description) return 'Add a short description of what completion means.'
  if (description.length > CUSTOM_HABIT_LIMITS.description) {
    return `Keep the description within ${CUSTOM_HABIT_LIMITS.description} characters.`
  }
  if (!['easy', 'medium', 'hard'].includes(input.difficulty)) {
    return 'Choose an objective difficulty.'
  }
  if ((input.cue?.trim().length ?? 0) > CUSTOM_HABIT_LIMITS.cue) {
    return `Keep the cue within ${CUSTOM_HABIT_LIMITS.cue} characters.`
  }
  if (
    input.reminderTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime)
  ) {
    return 'Choose a valid reminder time.'
  }
  if (!['oncePerPeriod', 'timesPerPeriod'].includes(input.frequency)) {
    return 'Choose a goal pattern.'
  }
  if (input.periodUnit !== 'days' && input.periodUnit !== 'weeks') {
    return 'Choose days or weeks for the period.'
  }
  const maximumPeriodLength = getMaximumPeriodLength(input.periodUnit)
  if (
    !Number.isInteger(input.periodLength) ||
    input.periodLength < 1 ||
    input.periodLength > maximumPeriodLength
  ) {
    return `Choose a period from 1 to ${maximumPeriodLength} ${input.periodUnit}.`
  }
  if (input.frequency === 'oncePerPeriod' && input.target !== 1) {
    return 'A once-per-period habit must need exactly one completion.'
  }
  if (
    input.frequency === 'timesPerPeriod' &&
    (!Number.isInteger(input.target) ||
      input.target < 2 ||
      input.target > CUSTOM_HABIT_LIMITS.target)
  ) {
    return `Choose a completion target from 2 to ${CUSTOM_HABIT_LIMITS.target}.`
  }
  if (
    existingTitles.some(
      (existingTitle) => existingTitle.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
  ) {
    return 'A habit with this name already exists in this profile.'
  }
  return null
}

export function updateCustomHabitQuest(
  quest: CustomHabitQuest,
  input: NewHabitInput,
  existingTitles: string[] = [],
): CustomHabitQuest {
  const validationError = getNewHabitValidationError(input, existingTitles)
  if (validationError) throw new Error(validationError)
  return {
    ...quest,
    title: input.title.trim(),
    description: input.description.trim(),
    difficulty: input.difficulty,
    schedule: createSchedule(input),
  }
}

export function habitInputFromQuest(
  quest: Quest,
  preferences: { cue?: string; reminderTime?: string | null } = {},
): NewHabitInput {
  const schedule = quest.schedule ?? { kind: 'daily' as const }
  const target =
    schedule.kind === 'periodTarget' || schedule.kind === 'quota'
      ? schedule.target
      : 1
  const periodDays = quest.group === 'longTerm'
    ? quest.durationDays ?? 7
    : schedule.kind === 'periodTarget' || schedule.kind === 'quota'
      ? schedule.periodDays
      : 1
  const isWeeklyPeriod =
    schedule.kind === 'weekly' ||
    periodDays === 7 &&
      (quest.group === 'longTerm' ||
        ((schedule.kind === 'periodTarget' || schedule.kind === 'quota') &&
          schedule.anchor === 'calendarWeek'))

  return {
    title: quest.title,
    description: quest.description,
    frequency: target === 1 ? 'oncePerPeriod' : 'timesPerPeriod',
    target,
    periodLength: isWeeklyPeriod ? 1 : periodDays,
    periodUnit: isWeeklyPeriod ? 'weeks' : 'days',
    difficulty: quest.difficulty,
    cue: preferences.cue ?? '',
    reminderTime: preferences.reminderTime ?? null,
  }
}

export function hasSameHabitScoringRules(
  quest: CustomHabitQuest,
  input: NewHabitInput,
) {
  return (
    quest.difficulty === input.difficulty &&
    JSON.stringify(quest.schedule) === JSON.stringify(createSchedule(input))
  )
}

export function createCustomHabitQuest(
  input: NewHabitInput,
  profile: HabitProfile,
  createdDate: string,
  existingTitles: string[] = [],
  id = createCustomHabitId(profile),
): CustomHabitQuest {
  const validationError = getNewHabitValidationError(input, existingTitles)
  if (validationError) {
    throw new Error(validationError)
  }

  return {
    id,
    emoji: profile === 'hana' ? '🌱' : '⚔️',
    title: input.title.trim(),
    description: input.description.trim(),
    group: 'daily',
    difficulty: input.difficulty,
    color: getCustomHabitColor(profile, input.difficulty),
    required: true,
    minLevel: 1,
    schedule: createSchedule(input),
    custom: true,
    createdDate,
  }
}

function createSchedule(input: NewHabitInput): QuestSchedule {
  const target = input.frequency === 'oncePerPeriod' ? 1 : input.target
  if (input.periodUnit === 'weeks' && input.periodLength === 1) {
    return {
      kind: 'periodTarget',
      target,
      periodDays: 7,
      anchor: 'calendarWeek',
    }
  }

  return {
    kind: 'periodTarget',
    target,
    periodDays: getHabitPeriodDays(input),
    anchor: 'questStart',
  }
}

export function getHabitPeriodDays(
  input: Pick<NewHabitInput, 'periodLength' | 'periodUnit'>,
) {
  return input.periodLength * (input.periodUnit === 'weeks' ? 7 : 1)
}

export function getMaximumPeriodLength(unit: HabitPeriodUnit) {
  return unit === 'weeks'
    ? CUSTOM_HABIT_LIMITS.periodWeeks
    : CUSTOM_HABIT_LIMITS.periodDays
}

export function formatHabitCadence(
  input: Pick<
    NewHabitInput,
    'frequency' | 'target' | 'periodLength' | 'periodUnit'
  >,
) {
  const target = input.frequency === 'oncePerPeriod' ? 1 : input.target
  if (input.periodUnit === 'days' && input.periodLength === 1) {
    return target === 1
      ? 'Complete once each day.'
      : `Complete ${target} times each day.`
  }
  if (input.periodUnit === 'weeks' && input.periodLength === 1) {
    return target === 1
      ? 'Complete once each calendar week.'
      : `Complete ${target} times each calendar week.`
  }

  const unit = input.periodUnit === 'days' ? 'day' : 'week'
  const period = `${input.periodLength}-${unit}`
  return target === 1
    ? `Complete once in every ${period} window.`
    : `Complete ${target} times in every ${period} window.`
}

function createCustomHabitId(profile: HabitProfile) {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `custom-${profile}-${randomId}`
}

function getCustomHabitColor(profile: HabitProfile, difficulty: Difficulty) {
  if (profile === 'cramble') {
    return {
      easy: '#8baebb',
      medium: '#d6a653',
      hard: '#e38678',
    }[difficulty]
  }

  return {
    easy: '#78ab63',
    medium: '#e7a53c',
    hard: '#d76a54',
  }[difficulty]
}
