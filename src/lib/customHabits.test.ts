import { describe, expect, it } from 'vitest'
import { crambleQuests } from '@/data/crambleQuests'
import { quests as hanaQuests } from '@/data/quests'
import {
  createCustomHabitQuest,
  formatHabitCadence,
  getNewHabitValidationError,
  resolveHabitPeriodPreset,
  type NewHabitInput,
} from '@/lib/customHabits'
import { createProfileCloudSyncPayload } from '@/lib/hanaCloudSync'
import { getHabitRangeStats, getProfileStats } from '@/lib/hanaStats'
import {
  createStartedHanaState,
  getQuestCatalog,
  getQuestScheduleProgress,
  getSkippedIdsForState,
  parseStoredHanaState,
  recomputeTotalFlowers,
  resetProfileProgress,
  syncStateToDate,
  toggleQuestCompletion,
  undoQuestCompletion,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import type { CustomHabitQuest, HanaGameState, Quest } from '@/types'

describe('custom habits', () => {
  it('maps Daily, Weekly, and Custom controls without changing the saved model', () => {
    expect(resolveHabitPeriodPreset('daily', 3)).toEqual({
      periodLength: 1,
      periodUnit: 'days',
    })
    expect(resolveHabitPeriodPreset('weekly', 3)).toEqual({
      periodLength: 1,
      periodUnit: 'weeks',
    })
    expect(resolveHabitPeriodPreset('custom', 7)).toEqual({
      periodLength: 7,
      periodUnit: 'days',
    })

    expect(
      createCustomHabitQuest(
        habitInput(resolveHabitPeriodPreset('weekly', 7)),
        'cramble',
        '2026-08-06',
        [],
        'custom-cramble-calendar-week',
      ).schedule,
    ).toEqual({
      kind: 'periodTarget',
      target: 1,
      periodDays: 7,
      anchor: 'calendarWeek',
    })
    expect(
      createCustomHabitQuest(
        habitInput(resolveHabitPeriodPreset('custom', 7)),
        'cramble',
        '2026-08-06',
        [],
        'custom-cramble-rolling-week',
      ).schedule,
    ).toEqual({
      kind: 'periodTarget',
      target: 1,
      periodDays: 7,
      anchor: 'questStart',
    })
  })

  it('creates configurable once-per-period and repeated period targets', () => {
    const everyThreeDays = createCustomHabitQuest(
      habitInput({
        title: '  Morning pages  ',
        description: '  Write one honest page.  ',
        periodLength: 3,
      }),
      'hana',
      '2026-08-06',
      [],
      'custom-hana-morning-pages',
    )
    const weekly = createCustomHabitQuest(
      habitInput({
        frequency: 'timesPerPeriod',
        target: 3,
        periodUnit: 'weeks',
      }),
      'hana',
      '2026-08-06',
      [],
      'custom-hana-weekly-training',
    )
    const tenDays = createCustomHabitQuest(
      habitInput({
        frequency: 'timesPerPeriod',
        target: 4,
        periodLength: 10,
      }),
      'cramble',
      '2026-08-06',
      [],
      'custom-cramble-ten-day-training',
    )

    expect(everyThreeDays).toEqual(
      expect.objectContaining({
        id: 'custom-hana-morning-pages',
        title: 'Morning pages',
        description: 'Write one honest page.',
        difficulty: 'medium',
        group: 'daily',
        required: true,
        minLevel: 1,
        custom: true,
        createdDate: '2026-08-06',
        schedule: {
          kind: 'periodTarget',
          target: 1,
          periodDays: 3,
          anchor: 'questStart',
        },
      }),
    )
    expect(weekly.schedule).toEqual({
      kind: 'periodTarget',
      target: 3,
      periodDays: 7,
      anchor: 'calendarWeek',
    })
    expect(tenDays.schedule).toEqual({
      kind: 'periodTarget',
      target: 4,
      periodDays: 10,
      anchor: 'questStart',
    })
    expect(
      createCustomHabitQuest(
        habitInput({ frequency: 'timesPerPeriod', target: 2 }),
        'hana',
        '2026-08-06',
      ).schedule,
    ).toEqual({
      kind: 'periodTarget',
      target: 2,
      periodDays: 1,
      anchor: 'questStart',
    })

    expect(formatHabitCadence(habitInput())).toBe('Complete once each day.')
    expect(
      formatHabitCadence(
        habitInput({ frequency: 'timesPerPeriod', target: 3, periodUnit: 'weeks' }),
      ),
    ).toBe('Complete 3 times each calendar week.')
  })

  it('validates flexible targets, periods, and duplicate copy', () => {
    expect(
      getNewHabitValidationError(habitInput({ title: '   ' })),
    ).toMatch(/name/i)
    expect(
      getNewHabitValidationError(habitInput({ description: '   ' })),
    ).toMatch(/description/i)
    expect(
      getNewHabitValidationError(
        habitInput({ title: 'Morning Pages' }),
        [' morning pages '],
      ),
    ).toMatch(/already exists/i)
    expect(
      getNewHabitValidationError(
        habitInput({ frequency: 'timesPerPeriod', target: 101 }),
      ),
    ).toMatch(/2 to 100/i)
    expect(
      getNewHabitValidationError(
        habitInput({ frequency: 'timesPerPeriod', target: 2.5 }),
      ),
    ).toMatch(/2 to 100/i)
    expect(
      getNewHabitValidationError(habitInput({ periodLength: 366 })),
    ).toMatch(/1 to 365/i)
    expect(
      getNewHabitValidationError(
        habitInput({ periodUnit: 'weeks', periodLength: 53 }),
      ),
    ).toMatch(/1 to 52/i)
  })

  it('shows a once-daily habit immediately and in each new daily period', () => {
    const habit = customHabit('custom-hana-daily')
    const started = {
      ...createStartedHanaState('2026-08-06'),
      customHabits: [habit],
    }

    const today = syncStateToDate(started, [], '2026-08-06')
    const tomorrow = syncStateToDate(today, [], '2026-08-07')

    expect(visibleQuestsForState([], today).daily.map(({ id }) => id)).toEqual([
      habit.id,
    ])
    expect(visibleQuestsForState([], tomorrow).daily.map(({ id }) => id)).toEqual([
      habit.id,
    ])
  })

  it('records two same-day occurrences, rewards only at the goal, caps, and undoes', () => {
    const habit = customHabit('custom-hana-brush-twice', {
      frequency: 'timesPerPeriod',
      target: 2,
    })
    const state = stateWithCustomHabits('2026-08-06', [habit])

    const first = toggleQuestCompletion(state, habit)
    expect(first.habitOccurrences['2026-08-06']?.[habit.id]).toBe(1)
    expect(getQuestScheduleProgress(first, habit)).toEqual(
      expect.objectContaining({
        completed: 1,
        completedToday: 1,
        target: 2,
        remaining: 1,
        isComplete: false,
        label: '1 of 2 today',
      }),
    )
    expect(recomputeTotalFlowers(first, [])).toBe(0)

    const complete = toggleQuestCompletion(first, habit)
    expect(complete.habitOccurrences['2026-08-06']?.[habit.id]).toBe(2)
    expect(getQuestScheduleProgress(complete, habit).isComplete).toBe(true)
    expect(recomputeTotalFlowers(complete, [])).toBe(2)

    const capped = toggleQuestCompletion(complete, habit)
    expect(capped).toBe(complete)
    expect(recomputeTotalFlowers(capped, [])).toBe(2)

    const undone = undoQuestCompletion(complete, habit)
    expect(undone.habitOccurrences['2026-08-06']?.[habit.id]).toBe(1)
    expect(getQuestScheduleProgress(undone, habit).isComplete).toBe(false)
    expect(recomputeTotalFlowers(undone, [])).toBe(0)
  })

  it('recognizes a saved neutral skip for the current period goal', () => {
    const habit = customHabit('custom-hana-unskippable')
    const state = stateWithCustomHabits('2026-08-06', [habit], {
      questSkips: {
        '2026-08-02': {
          [`daily:${habit.id}:2026-08-06`]: true,
        },
      },
    })

    expect(getSkippedIdsForState([], state)[habit.id]).toBe(true)
  })

  it('completes a weekly period target and starts fresh on Sunday', () => {
    const habit = customHabit('custom-hana-weekly-reset', {
      frequency: 'timesPerPeriod',
      target: 3,
      periodUnit: 'weeks',
    })
    const state = stateWithCustomHabits('2026-08-08', [habit], {
      startDate: '2026-08-02',
      habitOccurrences: {
        '2026-08-02': { [habit.id]: 1 },
        '2026-08-05': { [habit.id]: 1 },
        '2026-08-08': { [habit.id]: 1 },
      },
    })

    expect(getQuestScheduleProgress(state, habit)).toEqual(
      expect.objectContaining({
        completed: 3,
        completedToday: 1,
        remaining: 0,
        isComplete: true,
        isScheduledToday: true,
      }),
    )

    const nextPeriod = syncStateToDate(state, [], '2026-08-09')
    expect(getQuestScheduleProgress(nextPeriod, habit)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-09',
        periodEnd: '2026-08-15',
        completed: 0,
        remaining: 3,
        isScheduledToday: true,
      }),
    )
  })

  it('anchors arbitrary periods to habit creation and supports spread counts', () => {
    const habit = customHabit('custom-hana-ten-day-anchor', {
      frequency: 'timesPerPeriod',
      target: 4,
      periodLength: 10,
      createdDate: '2026-08-06',
    })
    const state = stateWithCustomHabits('2026-08-15', [habit], {
      startDate: '2026-06-01',
      habitOccurrences: {
        '2026-08-06': { [habit.id]: 2 },
        '2026-08-14': { [habit.id]: 1 },
      },
    })

    expect(getQuestScheduleProgress(state, habit)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-06',
        periodEnd: '2026-08-15',
        completed: 3,
      }),
    )
    expect(
      getQuestScheduleProgress({ ...state, currentDate: '2026-08-16' }, habit),
    ).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-16',
        periodEnd: '2026-08-25',
        completed: 0,
      }),
    )
  })

  it('includes a custom Hana habit and its exact records in the shared Ledger', () => {
    const habit = customHabit('custom-hana-ledger', {
      frequency: 'timesPerPeriod',
      target: 3,
      periodLength: 10,
      createdDate: '2026-08-06',
    })
    const state = stateWithCustomHabits('2026-08-15', [habit], {
      startDate: '2026-08-06',
      habitOccurrences: {
        '2026-08-06': { [habit.id]: 1 },
        '2026-08-10': { [habit.id]: 2 },
      },
    })

    expect(getQuestCatalog(hanaQuests, state)).toContainEqual(habit)

    const ledger = getHabitRangeStats(
      state,
      hanaQuests,
      'hana',
      habit.id,
      'all',
    )
    expect(ledger).toEqual(
      expect.objectContaining({
        totalRecords: 3,
        completedPeriods: 1,
        missedPeriods: 0,
        successRate: 100,
      }),
    )
    expect(ledger?.periods).toEqual([
      expect.objectContaining({
        startDate: '2026-08-06',
        endDate: '2026-08-15',
        completed: 3,
        target: 3,
        status: 'completed',
      }),
    ])
    expect(ledger?.days.filter(({ count }) => count > 0)).toEqual([
      expect.objectContaining({ dateKey: '2026-08-06', count: 1 }),
      expect.objectContaining({ dateKey: '2026-08-10', count: 2 }),
    ])
  })

  it('renews a once-in-three-days goal and awards once per completed window', () => {
    const habit = customHabit('custom-hana-once-in-three', {
      periodLength: 3,
    })
    const firstWindow = toggleQuestCompletion(
      stateWithCustomHabits('2026-08-06', [habit]),
      habit,
    )
    expect(recomputeTotalFlowers(firstWindow, [])).toBe(2)

    const afterCompletionDay = syncStateToDate(
      firstWindow,
      [],
      '2026-08-08',
    )
    expect(getQuestScheduleProgress(afterCompletionDay, habit)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-06',
        periodEnd: '2026-08-08',
        isComplete: true,
        isScheduledToday: false,
      }),
    )

    const nextWindow = syncStateToDate(afterCompletionDay, [], '2026-08-09')
    expect(getQuestScheduleProgress(nextWindow, habit)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-09',
        completed: 0,
        isScheduledToday: true,
      }),
    )
    const secondCompletion = toggleQuestCompletion(nextWindow, habit)
    expect(recomputeTotalFlowers(secondCompletion, [])).toBe(4)
  })

  it('preserves legacy quota rewards from existing saved habits', () => {
    const legacy = {
      ...customHabit('custom-hana-legacy-quota'),
      schedule: {
        kind: 'quota',
        target: 3,
        periodDays: 7,
        anchor: 'calendarWeek',
      },
    } as CustomHabitQuest
    const snapshot = stateWithCustomHabits('2026-08-06', [legacy], {
      startDate: '2026-08-02',
      dailyCompletions: {
        '2026-08-03': { [legacy.id]: true },
        '2026-08-05': { [legacy.id]: true },
      },
    })
    const parsed = parseStoredHanaState(
      JSON.stringify(snapshot),
      [],
      '2026-08-06',
    )

    expect(parsed.customHabits[0]?.schedule.kind).toBe('quota')
    expect(recomputeTotalFlowers(parsed, [])).toBe(4)
  })

  it('awards and removes one period reward at each custom difficulty', () => {
    const habits = [
      customHabit('custom-hana-easy', { difficulty: 'easy' }),
      customHabit('custom-hana-medium', { difficulty: 'medium' }),
      customHabit('custom-hana-hard', { difficulty: 'hard' }),
    ]
    let state = stateWithCustomHabits('2026-08-06', habits)
    habits.forEach((habit) => {
      state = toggleQuestCompletion(state, habit)
    })

    expect(recomputeTotalFlowers(state, [])).toBe(6)

    state = undoQuestCompletion(state, habits[1])
    expect(recomputeTotalFlowers(state, [])).toBe(4)
  })

  it('resets occurrence progress while preserving custom habits and date', () => {
    const habit = customHabit('custom-hana-survives-reset', {
      difficulty: 'hard',
    })
    const state = stateWithCustomHabits('2026-08-12', [habit], {
      startDate: '2026-08-01',
      habitOccurrences: {
        '2026-08-12': { [habit.id]: 1 },
      },
      questSkips: {
        '2026-08-09': { [`daily:${habit.id}:2026-08-12`]: true },
      },
      eveningWeeds: {
        '2026-08-12': { 'scroll-fog': true },
      },
      totalFlowers: 3,
    })

    const reset = resetProfileProgress(state, [])

    expect(reset.startDate).toBe('2026-08-01')
    expect(reset.currentDate).toBe('2026-08-12')
    expect(reset.customHabits).toEqual([habit])
    expect(reset.customHabits).not.toBe(state.customHabits)
    expect(reset.dailyCompletions).toEqual({})
    expect(reset.habitOccurrences).toEqual({})
    expect(reset.longTermCompletions).toEqual({})
    expect(reset.questSkips).toEqual({})
    expect(reset.eveningWeeds).toEqual({})
    expect(reset.totalFlowers).toBe(0)
    expect(reset.activeDailyQuests['2026-08-12']).toContain(habit.id)
  })

  it('normalizes old snapshots and filters malformed occurrence counts', () => {
    const habit = customHabit('custom-hana-valid')
    const oldSnapshot: Record<string, unknown> = {
      ...createStartedHanaState('2026-08-06'),
      customHabits: [habit],
      dailyCompletions: {
        '2026-08-06': { 'morning-dew': true },
      },
    }
    delete oldSnapshot.habitOccurrences
    const oldParsed = parseStoredHanaState(
      JSON.stringify(oldSnapshot),
      hanaQuests,
      '2026-08-06',
    )
    expect(oldParsed.habitOccurrences).toEqual({})
    expect(oldParsed.dailyCompletions['2026-08-06']?.['morning-dew']).toBe(true)

    const malformedCounts = {
      ...createStartedHanaState('2026-08-06'),
      customHabits: [habit],
      dailyCompletions: {
        '2026-08-06': { [habit.id]: true },
      },
      habitOccurrences: {
        '2026-08-06': {
          [habit.id]: 1,
          negative: -1,
          fractional: 1.5,
          excessive: 101,
          string: '2',
        },
        'not-a-date': { [habit.id]: 1 },
      },
    }
    const parsed = parseStoredHanaState(
      JSON.stringify(malformedCounts),
      [],
      '2026-08-06',
    )
    expect(parsed.habitOccurrences).toEqual({
      '2026-08-06': { [habit.id]: 1 },
    })
    expect(parsed.totalFlowers).toBe(2)
  })

  it('rejects malformed and colliding saved habits', () => {
    const valid = customHabit('custom-hana-valid')
    const duplicate = { ...valid, title: 'Different title' }
    const staticCollision = {
      ...valid,
      id: 'morning-dew',
      title: 'A non-catalog title',
    }
    const titleCollision = {
      ...valid,
      id: 'custom-hana-title-collision',
      title: hanaQuests[0].title,
    }
    const malformed = {
      ...valid,
      id: 'custom-hana-malformed',
      title: 'Malformed schedule',
      schedule: {
        kind: 'periodTarget',
        target: 101,
        periodDays: 1,
        anchor: 'questStart',
      },
    }
    const colonId = {
      ...valid,
      id: 'custom:hana:unsafe',
      title: 'Unsafe identifier',
    }
    const snapshot = {
      ...createStartedHanaState('2026-08-06'),
      customHabits: [
        valid,
        duplicate,
        staticCollision,
        titleCollision,
        malformed,
        colonId,
      ],
      habitOccurrences: {
        '2026-08-06': {
          [valid.id]: 1,
          [malformed.id]: 1,
        },
      },
    }

    const parsed = parseStoredHanaState(
      JSON.stringify(snapshot),
      hanaQuests,
      '2026-08-06',
    )

    expect(parsed.customHabits.map(({ id }) => id)).toEqual([valid.id])
    expect(parsed.totalFlowers).toBe(2)
    expect(getQuestCatalog(hanaQuests, parsed).filter(({ custom }) => custom)).toEqual([
      expect.objectContaining({ id: valid.id }),
    ])
  })

  it('keeps custom catalogs, counts, cloud rows, and stats isolated by profile', () => {
    const hanaHabit = customHabit('custom-hana-shared-name', {
      title: 'Shared display name',
      difficulty: 'easy',
    })
    const crambleHabit = customHabit('custom-cramble-shared-name', {
      profile: 'cramble',
      title: 'Shared display name',
      difficulty: 'hard',
    })
    const hanaState = completeCustomHabit(
      stateWithCustomHabits('2026-08-06', [hanaHabit]),
      hanaHabit,
      hanaQuests,
    )
    const crambleState = completeCustomHabit(
      stateWithCustomHabits('2026-08-06', [crambleHabit]),
      crambleHabit,
      crambleQuests,
    )

    const hanaPayload = createProfileCloudSyncPayload(
      'hana',
      hanaState,
      hanaQuests,
      '2026-08-06T10:00:00.000Z',
    )
    const cramblePayload = createProfileCloudSyncPayload(
      'cramble',
      crambleState,
      crambleQuests,
      '2026-08-06T10:00:00.000Z',
    )

    expect(hanaPayload.state.customHabits.map(({ id }) => id)).toEqual([
      hanaHabit.id,
    ])
    expect(cramblePayload.state.customHabits.map(({ id }) => id)).toEqual([
      crambleHabit.id,
    ])
    expect(hanaPayload.state.habitOccurrences).toEqual({
      '2026-08-06': { [hanaHabit.id]: 1 },
    })
    expect(cramblePayload.state.habitOccurrences).toEqual({
      '2026-08-06': { [crambleHabit.id]: 1 },
    })
    expect(hanaPayload.questStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'hana',
          questId: hanaHabit.id,
          status: 'completed',
          flowersEarned: 1,
        }),
      ]),
    )
    expect(cramblePayload.questStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'cramble',
          questId: crambleHabit.id,
          status: 'completed',
          flowersEarned: 3,
        }),
      ]),
    )
    expect(hanaPayload.questStatuses.some(({ questId }) => questId === crambleHabit.id)).toBe(
      false,
    )
    expect(cramblePayload.questStatuses.some(({ questId }) => questId === hanaHabit.id)).toBe(
      false,
    )
    expect(
      getProfileStats(crambleState, crambleQuests, 'cramble').questStats,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questId: crambleHabit.id,
          title: crambleHabit.title,
          completed: 1,
        }),
      ]),
    )
  })
})

type HabitOverrides = Partial<NewHabitInput> & {
  profile?: 'hana' | 'cramble'
  createdDate?: string
}

function habitInput(overrides: Partial<NewHabitInput> = {}): NewHabitInput {
  return {
    title: 'Intentional practice',
    description: 'Complete one clearly defined practice.',
    frequency: 'oncePerPeriod',
    target: 1,
    periodLength: 1,
    periodUnit: 'days',
    difficulty: 'medium',
    ...overrides,
  }
}

function customHabit(
  id: string,
  overrides: HabitOverrides = {},
): CustomHabitQuest {
  const {
    profile = 'hana',
    createdDate = '2026-08-06',
    ...inputOverrides
  } = overrides
  return createCustomHabitQuest(
    habitInput(inputOverrides),
    profile,
    createdDate,
    [],
    id,
  )
}

function stateWithCustomHabits(
  currentDate: string,
  customHabits: CustomHabitQuest[],
  overrides: Partial<HanaGameState> = {},
) {
  return syncStateToDate(
    {
      ...createStartedHanaState(currentDate),
      customHabits,
      ...overrides,
      currentDate,
    },
    [],
    currentDate,
  )
}

function completeCustomHabit(
  state: HanaGameState,
  habit: CustomHabitQuest,
  baseQuests: Quest[],
) {
  const toggled = toggleQuestCompletion(state, habit)
  return {
    ...toggled,
    totalFlowers: recomputeTotalFlowers(toggled, baseQuests),
  }
}
