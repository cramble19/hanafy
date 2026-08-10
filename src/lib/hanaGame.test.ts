import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState, Quest } from '@/types'
import {
  createStartedHanaState,
  getLongTermQuestStatus,
  getQuestScheduleProgress,
  getSkipProgress,
  hasValidQuestSchedule,
  parseStoredHanaState,
  recomputeTotalFlowers,
  syncStateToDate,
  todayKey,
  visibleQuestsForState,
} from './hanaGame'

describe('Hana game date sync', () => {
  it('uses 4:00 AM as the shared Today boundary', () => {
    expect(todayKey(new Date(2026, 7, 7, 3, 59, 59, 999))).toBe('2026-08-06')
    expect(todayKey(new Date(2026, 7, 7, 4, 0, 0, 0))).toBe('2026-08-07')
  })

  it('moves an old installed PWA state to the real current date', () => {
    const storedState = JSON.stringify(
      createSavedState({
        currentDate: '2026-07-07',
        dailyCompletions: {
          '2026-07-07': {
            'morning-dew': true,
          },
        },
      }),
    )

    const state = parseStoredHanaState(storedState, quests, '2026-07-13')

    expect(state.currentDate).toBe('2026-07-13')
    expect(state.dailyCompletions['2026-07-07']?.['morning-dew']).toBe(true)
    expect(state.dailyCompletions['2026-07-13']).toBeUndefined()
    expect(state.activeDailyQuests['2026-07-13']?.length).toBeGreaterThan(0)
  })

  it('uses the synced date when choosing visible daily quests', () => {
    const oldState = createSavedState({
      currentDate: '2026-07-07',
      activeDailyQuests: {
        '2026-07-07': ['morning-dew', 'sun-catch', 'remember-cramble'],
      },
    })

    const syncedState = syncStateToDate(oldState, quests, '2026-07-13')
    const visibleQuests = visibleQuestsForState(quests, syncedState)

    expect(syncedState.currentDate).toBe('2026-07-13')
    expect(visibleQuests.daily.map((quest) => quest.id)).toEqual(
      syncedState.activeDailyQuests['2026-07-13'],
    )
  })

  it('renews an expired long-term quest window on the new date', () => {
    const oldState = createSavedState({
      currentDate: '2026-07-07',
      activeLongTermQuestIds: ['any-physical-effort'],
      longTermWindows: {
        'any-physical-effort': '2026-07-07',
      },
    })

    const syncedState = syncStateToDate(oldState, quests, '2026-07-13')
    const quest = quests.find((item) => item.id === 'any-physical-effort')

    expect(quest).toBeDefined()
    expect(syncedState.longTermWindows['any-physical-effort']).toBe('2026-07-13')
    expect(getLongTermQuestStatus(syncedState, quest!).label).toBe('4 days left')
  })

  it('calculates weekly skips from the synced week', () => {
    const oldState = createSavedState({
      currentDate: '2026-07-07',
      questSkips: {
        '2026-07-05': {
          'daily:morning-dew:2026-07-07': true,
        },
      },
    })

    const syncedState = syncStateToDate(oldState, quests, '2026-07-13')
    const skipProgress = getSkipProgress(syncedState)

    expect(skipProgress.weekKey).toBe('2026-07-12')
    expect(skipProgress.used).toBe(0)
    expect(skipProgress.remaining).toBe(3)
  })

  it('keeps omitted schedules daily and never cuts required scheduled tasks', () => {
    const requiredQuests = Array.from({ length: 4 }, (_, index) =>
      createDailyQuest(`required-${index + 1}`),
    )
    delete requiredQuests[0].schedule

    const state = syncStateToDate(
      createStartedHanaState('2026-08-06'),
      requiredQuests,
      '2026-08-06',
    )

    expect(visibleQuestsForState(requiredQuests, state).daily).toHaveLength(4)
    expect(getQuestScheduleProgress(state, requiredQuests[0]).kind).toBe(
      'daily',
    )
  })

  it('tracks a three-per-week quota and resets on Sunday', () => {
    const quest = createQuotaQuest('training-three', 3, 7, 'calendarWeek')
    const state = createSavedState({
      startDate: '2026-08-02',
      currentDate: '2026-08-06',
      dailyCompletions: {
        '2026-08-02': { [quest.id]: true },
        '2026-08-03': { [quest.id]: true },
      },
    })

    const partial = getQuestScheduleProgress(state, quest)
    expect(partial).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-02',
        periodEnd: '2026-08-08',
        completed: 2,
        remaining: 1,
        label: '2 of 3 this week',
        isScheduledToday: true,
      }),
    )

    state.dailyCompletions['2026-08-06'] = { [quest.id]: true }
    expect(getQuestScheduleProgress(state, quest).isScheduledToday).toBe(true)

    expect(
      getQuestScheduleProgress({ ...state, currentDate: '2026-08-07' }, quest)
        .isScheduledToday,
    ).toBe(false)

    const nextWeek = { ...state, currentDate: '2026-08-09' }
    expect(getQuestScheduleProgress(nextWeek, quest)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-09',
        completed: 0,
        remaining: 3,
        isScheduledToday: true,
      }),
    )
  })

  it('anchors rolling quota windows to the profile start date', () => {
    const quest = createQuotaQuest('four-in-ten', 4, 10, 'profileStart')
    const state = createSavedState({
      startDate: '2026-08-06',
      currentDate: '2026-08-15',
    })

    expect(getQuestScheduleProgress(state, quest)).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-06',
        periodEnd: '2026-08-15',
      }),
    )
    expect(
      getQuestScheduleProgress({ ...state, currentDate: '2026-08-16' }, quest),
    ).toEqual(
      expect.objectContaining({
        periodStart: '2026-08-16',
        periodEnd: '2026-08-25',
      }),
    )
  })

  it('caps quota rewards at one completion per target slot', () => {
    const quest = createQuotaQuest('three-rewards', 3, 7, 'calendarWeek')
    const state = createSavedState({
      startDate: '2026-08-02',
      currentDate: '2026-08-08',
      dailyCompletions: {
        '2026-08-02': { [quest.id]: true },
        '2026-08-03': { [quest.id]: true },
        '2026-08-04': { [quest.id]: true },
        '2026-08-05': { [quest.id]: true },
        '2026-08-06': { [quest.id]: true },
      },
    })

    expect(recomputeTotalFlowers(state, [quest])).toBe(3)
  })

  it('recomputes rewards from completed long-term windows', () => {
    const quest: Quest = {
      ...createDailyQuest('long-term-reward'),
      group: 'longTerm',
      difficulty: 'hard',
      durationDays: 7,
    }
    const state = createSavedState({
      longTermWindows: { [quest.id]: '2026-08-02' },
      longTermCompletions: {
        [quest.id]: { '2026-08-02': true },
      },
    })

    expect(recomputeTotalFlowers(state, [quest])).toBe(3)
  })

  it('rejects impossible catalog schedules', () => {
    const invalid = {
      ...createDailyQuest('invalid-quota'),
      schedule: {
        kind: 'quota',
        target: 8,
        periodDays: 7,
        anchor: 'calendarWeek',
      },
    } as unknown as Quest

    expect(hasValidQuestSchedule(invalid)).toBe(false)
    expect(
      hasValidQuestSchedule({
        ...createDailyQuest('unknown-schedule'),
        schedule: {
          kind: 'unknown',
          target: 1,
          periodDays: 1,
          anchor: 'profileStart',
        },
      } as unknown as Quest),
    ).toBe(false)
    expect(
      hasValidQuestSchedule({
        ...createDailyQuest('twice-daily'),
        createdDate: '2026-08-06',
        schedule: {
          kind: 'periodTarget',
          target: 2,
          periodDays: 1,
          anchor: 'questStart',
        },
      }),
    ).toBe(true)
  })
})

function createDailyQuest(id: string): Quest {
  return {
    id,
    emoji: '✓',
    title: id,
    description: id,
    group: 'daily',
    difficulty: 'easy',
    color: '#8baebb',
    required: true,
    minLevel: 1,
    schedule: { kind: 'daily' },
  }
}

function createQuotaQuest(
  id: string,
  target: number,
  periodDays: number,
  anchor: 'calendarWeek' | 'profileStart',
): Quest {
  return {
    ...createDailyQuest(id),
    schedule:
      anchor === 'calendarWeek'
        ? { kind: 'quota', target, periodDays: 7, anchor }
        : { kind: 'quota', target, periodDays, anchor },
  }
}

function createSavedState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    startDate: '2026-07-07',
    currentDate: '2026-07-07',
    customHabits: [],
    openActivities: [],
    openActivityLogs: {},
    dailyEmotions: {},
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    habitOccurrences: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
    ...overrides,
  }
}
