import { crambleQuests } from '@/data/crambleQuests'
import { quests as hanaQuests } from '@/data/quests'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import { createCustomHabitQuest, type NewHabitInput } from '@/lib/customHabits'
import {
  addDays,
  createStartedHanaState,
  STORAGE_KEY,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
} from '@/lib/hanaGame'
import { createOpenActivity } from '@/lib/openActivities'
import { HANA_PENDING_STORAGE_KEY } from '@/lib/profileCache'
import type { DailyEmotion, HanaGameState } from '@/types'

type DemoStorage = Pick<Storage, 'removeItem' | 'setItem'>

export type DemoProfileStates = {
  hana: HanaGameState
  cramble: HanaGameState
}

export function seedLocalDemoProfiles(
  storage: DemoStorage,
  dateKey = todayKey(),
) {
  const profiles = createDemoProfileStates(dateKey)
  storage.setItem(STORAGE_KEY, JSON.stringify(profiles.hana))
  storage.setItem(CRAMBLE_STORAGE_KEY, JSON.stringify(profiles.cramble))
  storage.removeItem(HANA_PENDING_STORAGE_KEY)
  storage.removeItem(CRAMBLE_PENDING_STORAGE_KEY)
  return profiles
}

export function createDemoProfileStates(dateKey: string): DemoProfileStates {
  const startDate = addDays(dateKey, -10)
  return {
    hana: createHanaDemoState(startDate, dateKey),
    cramble: createCrambleDemoState(startDate, dateKey),
  }
}

function createHanaDemoState(startDate: string, dateKey: string) {
  const initial = syncActiveQuestPlan(
    createStartedHanaState(startDate),
    hanaQuests,
  )
  const teaHabit = createCustomHabitQuest(
    habitInput({
      title: 'Evening tea ritual',
      description: 'Make one calming cup and drink it away from the screen.',
      emoji: '🫖',
      difficulty: 'easy',
    }),
    'hana',
    startDate,
    hanaQuests.map(({ title }) => title),
    'custom-hana-demo-evening-tea',
  )
  const refillHabit = createCustomHabitQuest(
    habitInput({
      title: 'Water refills',
      description: 'Refill the bottle three times during the day.',
      emoji: '💧',
      frequency: 'timesPerPeriod',
      target: 3,
      difficulty: 'medium',
    }),
    'hana',
    startDate,
    [...hanaQuests.map(({ title }) => title), teaHabit.title],
    'custom-hana-demo-water-refills',
  )
  const outdoorPages = createOpenActivity(
    {
      title: 'Pages read outside',
      description: 'A few pages read in fresh air.',
      emoji: '📖',
      kind: 'count',
      unit: 'pages',
    },
    'hana',
    startDate,
    initial.openActivities.map(({ title }) => title),
    'open-hana-demo-outdoor-pages',
  )
  const previousDates = previousDateKeys(dateKey)
  const withDefinitions = syncActiveQuestPlan(
    {
      ...initial,
      currentDate: dateKey,
      customHabits: [teaHabit, refillHabit],
      questActivations: {
        ...(initial.questActivations ?? {}),
        [teaHabit.id]: startDate,
        [refillHabit.id]: startDate,
      },
      openActivities: [...initial.openActivities, outdoorPages],
      dailyCompletions: {
        [previousDates[0]]: { 'morning-dew': true, 'flower-breath': true },
        [previousDates[1]]: { 'morning-dew': true },
        [previousDates[2]]: { 'flower-breath': true },
        [dateKey]: { 'morning-dew': true },
      },
      habitOccurrences: {
        [dateKey]: {
          [teaHabit.id]: 1,
          [refillHabit.id]: 1,
        },
      },
      longTermCompletions: {
        'any-physical-effort': { [startDate]: true },
      },
      dailyEmotions: emotionHistory(previousDates, dateKey, 'good'),
      openActivityLogs: {
        [dateKey]: {
          'custom-hana-energy-check-in': 4,
          'custom-hana-productive-day': 1,
        },
      },
      eveningWeeds: {
        [dateKey]: { 'late-night-spiral': true },
      },
    },
    hanaQuests,
  )

  return syncStateToDate(withDefinitions, hanaQuests, dateKey)
}

function createCrambleDemoState(startDate: string, dateKey: string) {
  const initial = syncActiveQuestPlan(
    createStartedHanaState(startDate),
    crambleQuests,
    CRAMBLE_QUEST_PLAN_OPTIONS,
  )
  const readingHabit = createCustomHabitQuest(
    habitInput({
      title: 'Ten pages by lantern light',
      description: 'Read ten unrushed pages before closing the chapter.',
      emoji: '🕯️',
      difficulty: 'medium',
    }),
    'cramble',
    startDate,
    crambleQuests.map(({ title }) => title),
    'custom-cramble-demo-reading',
  )
  const walkHabit = createCustomHabitQuest(
    habitInput({
      title: 'Sunset patrol',
      description: 'Take one intentional walk before the day closes.',
      emoji: '🦉',
      difficulty: 'easy',
    }),
    'cramble',
    startDate,
    [...crambleQuests.map(({ title }) => title), readingHabit.title],
    'custom-cramble-demo-sunset-walk',
  )
  const pagesRead = createOpenActivity(
    {
      title: 'Pages entered in the archive',
      description: 'Count every page read without making it an oath.',
      emoji: '📜',
      kind: 'count',
      unit: 'pages',
    },
    'cramble',
    startDate,
    [],
    'open-cramble-demo-pages',
  )
  const kindMoment = createOpenActivity(
    {
      title: 'Shared a kind moment',
      description: 'Record a small kindness worth remembering.',
      emoji: '✨',
      kind: 'check',
    },
    'cramble',
    startDate,
    [pagesRead.title],
    'open-cramble-demo-kind-moment',
  )
  const campfireTea = createOpenActivity(
    {
      title: 'Campfire tea',
      description: 'A quiet cup taken without hurry.',
      emoji: '☕',
      kind: 'check',
    },
    'cramble',
    startDate,
    [pagesRead.title, kindMoment.title],
    'open-cramble-demo-campfire-tea',
  )
  const previousDates = previousDateKeys(dateKey)
  const withDefinitions = syncActiveQuestPlan(
    {
      ...initial,
      currentDate: dateKey,
      customHabits: [readingHabit, walkHabit],
      questActivations: {
        ...(initial.questActivations ?? {}),
        [readingHabit.id]: startDate,
        [walkHabit.id]: startDate,
      },
      openActivities: [pagesRead, kindMoment, campfireTea],
      dailyCompletions: {
        [previousDates[0]]: { 'first-draught': true, 'training-yard': true },
        [previousDates[1]]: { 'provisioners-plate': true },
        [previousDates[2]]: { 'evening-seal': true },
        [dateKey]: {
          'first-draught': true,
          'provisioners-plate': true,
        },
      },
      habitOccurrences: {
        [dateKey]: {
          [readingHabit.id]: 1,
        },
      },
      dailyEmotions: emotionHistory(previousDates, dateKey, 'bright'),
      openActivityLogs: {
        [dateKey]: {
          [pagesRead.id]: 12,
          [campfireTea.id]: 1,
        },
      },
    },
    crambleQuests,
    CRAMBLE_QUEST_PLAN_OPTIONS,
  )

  return syncStateToDate(
    withDefinitions,
    crambleQuests,
    dateKey,
    CRAMBLE_QUEST_PLAN_OPTIONS,
  )
}

function habitInput(overrides: Partial<NewHabitInput>): NewHabitInput {
  return {
    title: 'Demo habit',
    description: 'A realistic local-only habit for interface review.',
    frequency: 'oncePerPeriod',
    target: 1,
    periodLength: 1,
    periodUnit: 'days',
    difficulty: 'easy',
    completionStyle: 'forgiving',
    ...overrides,
  }
}

function previousDateKeys(dateKey: string) {
  return [addDays(dateKey, -3), addDays(dateKey, -2), addDays(dateKey, -1)]
}

function emotionHistory(
  previousDates: string[],
  dateKey: string,
  todayEmotion: DailyEmotion,
) {
  return {
    [previousDates[0]]: 'okay',
    [previousDates[1]]: 'good',
    [previousDates[2]]: 'low',
    [dateKey]: todayEmotion,
  } satisfies Record<string, DailyEmotion>
}
