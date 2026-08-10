import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState, Quest } from '@/types'
import {
  formatQuestCadence,
  getCalendarWindow,
  getHabitMomentumSignal,
  getHabitRangeStats,
  getHanaStats,
  getQuestHistory,
  getWeedHistory,
  type HabitPeriodStat,
} from './hanaStats'

describe('Hana stats', () => {
  it('summarizes completed, skipped, missed, and open quests gently', () => {
    const stats = getHanaStats(
      createState({
        currentDate: '2026-07-14',
        activeDailyQuests: {
          '2026-07-13': ['morning-dew', 'sun-catch'],
          '2026-07-14': ['morning-dew', 'sun-catch'],
        },
        dailyCompletions: {
          '2026-07-13': {
            'morning-dew': true,
          },
        },
        questSkips: {
          '2026-07-12': {
            'daily:sun-catch:2026-07-14': true,
          },
        },
        eveningWeeds: {
          '2026-07-13': {
            'scroll-fog': true,
          },
          '2026-07-14': {
            'scroll-fog': true,
            'phone-in-bed-ivy': true,
          },
        },
      }),
      quests,
    )

    expect(stats.totalShown).toBe(4)
    expect(stats.completed).toBe(1)
    expect(stats.skipped).toBe(1)
    expect(stats.missed).toBe(0)
    expect(stats.open).toBe(2)
    expect(stats.completionRate).toBe(100)
    expect(stats.skipRate).toBe(25)
    expect(stats.needsLove).toHaveLength(0)
    expect(stats.weedStats[0]).toEqual({ weedId: 'scroll-fog', checked: 2 })
  })

  it('builds per-quest and per-weed history for detail calendars', () => {
    const state = createState({
      currentDate: '2026-07-14',
      activeDailyQuests: {
        '2026-07-12': ['morning-dew'],
        '2026-07-13': ['morning-dew'],
        '2026-07-14': ['morning-dew'],
      },
      dailyCompletions: {
        '2026-07-12': {
          'morning-dew': true,
        },
      },
      questSkips: {
        '2026-07-12': {
          'daily:morning-dew:2026-07-13': true,
        },
      },
      eveningWeeds: {
        '2026-07-12': {
          'scroll-fog': true,
        },
        '2026-07-14': {
          'scroll-fog': true,
        },
      },
    })

    const questHistory = getQuestHistory(state, quests, 'morning-dew')
    const weedHistory = getWeedHistory(state, 'scroll-fog')

    expect(questHistory.stat.completed).toBe(1)
    expect(questHistory.stat.skipped).toBe(1)
    expect(questHistory.stat.open).toBe(1)
    expect(questHistory.days.map((day) => [day.dateKey, day.status])).toEqual([
      ['2026-07-12', 'completed'],
      ['2026-07-13', 'skipped'],
      ['2026-07-14', 'open'],
    ])
    expect(weedHistory).toEqual({
      weedId: 'scroll-fog',
      checked: 2,
      dates: ['2026-07-12', '2026-07-14'],
    })
    expect(getCalendarWindow('2026-07-14', 3)).toEqual([
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
    ])
  })

  it('scores a quota once per period without false daily misses', () => {
    const quest = createQuotaQuest()
    const state = createState({
      startDate: '2026-08-02',
      currentDate: '2026-08-08',
      activeDailyQuests: {
        '2026-08-06': [quest.id],
        '2026-08-07': [quest.id],
        '2026-08-08': [quest.id],
      },
      dailyCompletions: {
        '2026-08-06': { [quest.id]: true },
        '2026-08-07': { [quest.id]: true },
      },
    })

    const partial = getHanaStats(state, [quest])
    expect(partial).toEqual(
      expect.objectContaining({
        totalShown: 1,
        completed: 0,
        missed: 0,
        open: 1,
      }),
    )

    state.dailyCompletions['2026-08-08'] = { [quest.id]: true }
    const complete = getHanaStats(state, [quest])
    expect(complete).toEqual(
      expect.objectContaining({
        totalShown: 1,
        completed: 1,
        missed: 0,
        open: 0,
        completionRate: 100,
      }),
    )
  })

  it('scores a repeated habit once only when its period target is complete', () => {
    const quest = createPeriodTargetQuest()
    const state = createState({
      currentDate: '2026-08-06',
      activeDailyQuests: {
        '2026-08-06': [quest.id],
      },
      habitOccurrences: {
        '2026-08-06': { [quest.id]: 1 },
      },
    })

    expect(getHanaStats(state, [quest])).toEqual(
      expect.objectContaining({
        totalShown: 1,
        completed: 0,
        missed: 0,
        open: 1,
      }),
    )

    state.habitOccurrences['2026-08-06'][quest.id] = 2
    expect(getHanaStats(state, [quest])).toEqual(
      expect.objectContaining({
        totalShown: 1,
        completed: 1,
        missed: 0,
        open: 0,
        completionRate: 100,
      }),
    )
  })

  it('derives untouched daily opportunities instead of hiding missed days', () => {
    const quest: Quest = {
      id: 'daily-practice',
      emoji: 'D',
      title: 'Daily practice',
      description: 'Practice once.',
      group: 'daily',
      difficulty: 'easy',
      color: '#9fb683',
      required: true,
      schedule: { kind: 'daily' },
    }
    const stats = getHabitRangeStats(
      createState({
        startDate: '2026-08-01',
        currentDate: '2026-08-06',
        dailyCompletions: {
          '2026-08-02': { [quest.id]: true },
          '2026-08-05': { [quest.id]: true },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      7,
    )

    expect(stats).toEqual(
      expect.objectContaining({
        rangeStart: '2026-08-01',
        activeDays: 6,
        completedPeriods: 2,
        missedPeriods: 1,
        decidedPeriods: 3,
        successRate: 67,
        totalRecords: 2,
        weeklyPace: 2.3,
      }),
    )
    expect(stats?.periods.map(({ status }) => status)).toEqual([
      'missed',
      'completed',
      'open',
      'open',
      'completed',
      'open',
    ])
  })

  it('treats an exact weekly task as one due day, not seven daily misses', () => {
    const quest: Quest = {
      id: 'sunday-tablet',
      emoji: 'S',
      title: 'Sunday tablet',
      description: 'Take it on Sunday.',
      group: 'daily',
      difficulty: 'easy',
      color: '#d6a653',
      required: true,
      schedule: { kind: 'weekly', daysOfWeek: [0] },
    }
    const stats = getHabitRangeStats(
      createState({
        startDate: '2026-07-26',
        currentDate: '2026-08-06',
        dailyCompletions: {
          '2026-07-26': { [quest.id]: true },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      30,
    )

    expect(stats?.periods).toEqual([
      expect.objectContaining({
        startDate: '2026-07-26',
        completed: 1,
        status: 'completed',
      }),
      expect.objectContaining({
        startDate: '2026-08-02',
        completed: 0,
        status: 'missed',
      }),
    ])
    expect(stats?.nextDueDate).toBe('2026-08-09')
    expect(formatQuestCadence(quest)).toBe('Every Sunday')
  })

  it('shows one outcome per rolling ten-day window and exact record days', () => {
    const quest = createPeriodTargetQuest({
      id: 'letter-home',
      target: 1,
      periodDays: 10,
      createdDate: '2026-07-01',
    })
    const stats = getHabitRangeStats(
      createState({
        startDate: '2026-07-01',
        currentDate: '2026-07-25',
        habitOccurrences: {
          '2026-07-04': { [quest.id]: 1 },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      30,
    )

    expect(stats?.periods).toEqual([
      expect.objectContaining({
        startDate: '2026-07-01',
        endDate: '2026-07-10',
        completed: 1,
        target: 1,
        status: 'completed',
      }),
      expect.objectContaining({
        startDate: '2026-07-11',
        endDate: '2026-07-20',
        completed: 0,
        status: 'missed',
      }),
      expect.objectContaining({
        startDate: '2026-07-21',
        endDate: '2026-07-30',
        status: 'open',
      }),
    ])
    expect(stats?.days.filter(({ count }) => count > 0)).toEqual([
      expect.objectContaining({ dateKey: '2026-07-04', count: 1 }),
    ])
    expect(
      stats?.days.find(({ dateKey }) => dateKey === '2026-07-03')?.isEligible,
    ).toBe(true)
    expect(
      stats?.days.find(({ dateKey }) => dateKey === '2026-07-04')?.isEligible,
    ).toBe(true)
    expect(
      stats?.days.find(({ dateKey }) => dateKey === '2026-07-05')?.isEligible,
    ).toBe(false)
    expect(stats).toEqual(
      expect.objectContaining({
        completedPeriods: 1,
        missedPeriods: 1,
        successRate: 50,
        totalRecords: 1,
      }),
    )
    expect(formatQuestCadence(quest)).toBe('Once every 10 days')
  })

  it('keeps count progress for several-times-in-ten-days goals', () => {
    const quest = createPeriodTargetQuest({
      id: 'training-ten',
      target: 3,
      periodDays: 10,
      createdDate: '2026-07-01',
    })
    const stats = getHabitRangeStats(
      createState({
        startDate: '2026-07-01',
        currentDate: '2026-07-25',
        habitOccurrences: {
          '2026-07-01': { [quest.id]: 2 },
          '2026-07-05': { [quest.id]: 1 },
          '2026-07-12': { [quest.id]: 2 },
          '2026-07-22': { [quest.id]: 2 },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      90,
    )

    expect(stats?.periods.map(({ completed, target, status }) => [
      completed,
      target,
      status,
    ])).toEqual([
      [3, 3, 'completed'],
      [2, 3, 'missed'],
      [2, 3, 'open'],
    ])
    expect(stats).toEqual(
      expect.objectContaining({
        completedPeriods: 1,
        missedPeriods: 1,
        decidedPeriods: 2,
        totalRecords: 7,
        weeklyPace: 2,
      }),
    )
    expect(formatQuestCadence(quest)).toBe('3 times every 10 days')

    const sevenDayStats = getHabitRangeStats(
      createState({
        startDate: '2026-07-01',
        currentDate: '2026-07-25',
        habitOccurrences: {
          '2026-07-01': { [quest.id]: 2 },
          '2026-07-05': { [quest.id]: 1 },
          '2026-07-12': { [quest.id]: 2 },
          '2026-07-22': { [quest.id]: 2 },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      7,
    )
    expect(sevenDayStats).toEqual(
      expect.objectContaining({
        rangeStart: '2026-07-19',
        totalRecords: 2,
      }),
    )
    expect(
      sevenDayStats?.periods.map(({ startDate, completed, target }) => [
        startDate,
        completed,
        target,
      ]),
    ).toEqual([
      ['2026-07-11', 2, 3],
      ['2026-07-21', 2, 3],
    ])
  })

  it('shows same-day counts for a twice-daily goal', () => {
    const quest = createPeriodTargetQuest({
      id: 'brush-twice-stats',
      target: 2,
      periodDays: 1,
      createdDate: '2026-08-05',
    })
    const stats = getHabitRangeStats(
      createState({
        startDate: '2026-08-01',
        currentDate: '2026-08-06',
        habitOccurrences: {
          '2026-08-05': { [quest.id]: 1 },
          '2026-08-06': { [quest.id]: 2 },
        },
      }),
      [quest],
      'cramble',
      quest.id,
      7,
    )

    expect(
      stats?.periods.map(({ completed, status }) => [completed, status]),
    ).toEqual([
      [1, 'open'],
      [2, 'completed'],
    ])
    expect(stats?.days.map(({ count }) => count)).toEqual([1, 2])
    expect(stats).toEqual(
      expect.objectContaining({
        completedPeriods: 1,
        missedPeriods: 0,
        totalRecords: 3,
        successRate: 100,
        nextDueDate: '2026-08-07',
      }),
    )
  })

  it('keeps passes neutral and avoids inventing locked quest history', () => {
    const dailyQuest: Quest = {
      id: 'gentle-daily',
      emoji: 'G',
      title: 'Gentle daily',
      description: 'One daily step.',
      group: 'daily',
      difficulty: 'easy',
      color: '#9fb683',
      required: true,
      schedule: { kind: 'daily' },
    }
    const state = createState({
      startDate: '2026-08-04',
      currentDate: '2026-08-06',
      dailyCompletions: {
        '2026-08-04': { [dailyQuest.id]: true },
      },
      questSkips: {
        '2026-08-02': {
          [`daily:${dailyQuest.id}:2026-08-05`]: true,
        },
      },
    })
    const stats = getHabitRangeStats(
      state,
      [dailyQuest],
      'cramble',
      dailyQuest.id,
      7,
    )

    expect(stats).toEqual(
      expect.objectContaining({
        completedPeriods: 1,
        missedPeriods: 0,
        skippedPeriods: 1,
        decidedPeriods: 1,
        successRate: 100,
      }),
    )

    const lockedQuest = { ...dailyQuest, id: 'locked', minLevel: 3 }
    const lockedStats = getHabitRangeStats(
      state,
      [lockedQuest],
      'cramble',
      lockedQuest.id,
      'all',
    )
    expect(lockedStats?.periods).toEqual([])
    expect(lockedStats?.currentPeriod).toBeNull()
    expect(lockedStats?.days).toEqual([
      expect.objectContaining({
        dateKey: '2026-08-06',
        count: 0,
        isEligible: false,
      }),
    ])
    expect(
      getHabitRangeStats(state, [dailyQuest], 'cramble', 'unknown', 30),
    ).toBeNull()
  })

  it('celebrates momentum quickly and raises concern slowly', () => {
    expect(
      getHabitMomentumSignal(
        { periods: [momentumPeriod('completed', 1)] },
        'cramble',
      ),
    ).toBeNull()

    expect(
      getHabitMomentumSignal(
        {
          periods: [
            momentumPeriod('completed', 1),
            momentumPeriod('completed', 2),
            momentumPeriod('skipped', 3),
            momentumPeriod('open', 4),
          ],
        },
        'cramble',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'combo',
        emoji: '🔥',
        label: '2 combo',
        windowCount: 2,
      }),
    )

    expect(
      getHabitMomentumSignal(
        {
          periods: [
            momentumPeriod('completed', 1),
            momentumPeriod('completed', 2),
            momentumPeriod('completed', 3),
            momentumPeriod('missed', 4),
          ],
        },
        'hana',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'combo',
        label: 'Strong rhythm',
      }),
    )

    expect(
      getHabitMomentumSignal(
        {
          periods: [
            momentumPeriod('missed', 1),
            momentumPeriod('missed', 2),
          ],
        },
        'hana',
      ),
    ).toBeNull()

    expect(
      getHabitMomentumSignal(
        {
          periods: [
            momentumPeriod('missed', 1),
            momentumPeriod('missed', 2),
            momentumPeriod('missed', 3),
          ],
        },
        'hana',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'needsCare',
        emoji: '🥀',
        label: 'Needs care',
        windowCount: 3,
      }),
    )

    expect(
      getHabitMomentumSignal(
        {
          periods: [
            momentumPeriod('missed', 1),
            momentumPeriod('missed', 2),
            momentumPeriod('missed', 3),
          ],
        },
        'cramble',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'needsCare',
        emoji: '🕯️',
        label: 'Rekindle',
      }),
    )
  })

  it('keeps weekly pace stable while a habit remains archived', () => {
    const quest = createPeriodTargetQuest({
      id: 'archived-daily',
      target: 1,
      createdDate: '2026-08-01',
    })
    const state = createState({
      startDate: '2026-08-01',
      currentDate: '2026-08-10',
      activeDailyQuests: {
        '2026-08-01': [quest.id],
      },
      habitOccurrences: {
        '2026-08-01': { [quest.id]: 1 },
      },
      habitSettings: {
        [quest.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: '2026-08-02',
          pauses: [],
        },
      },
    })

    const stats = getHabitRangeStats(state, [quest], 'hana', quest.id, 'all')

    expect(stats?.activeDays).toBe(1)
    expect(stats?.weeklyPace).toBe(7)
  })
})

function momentumPeriod(
  status: HabitPeriodStat['status'],
  day: number,
): HabitPeriodStat {
  const dateKey = `2026-08-${String(day).padStart(2, '0')}`
  return {
    periodKey: dateKey,
    startDate: dateKey,
    endDate: dateKey,
    completed: status === 'completed' ? 1 : 0,
    target: 1,
    status,
  }
}

function createQuotaQuest(): Quest {
  return {
    id: 'training-three',
    emoji: '⚔️',
    title: 'Training Three',
    description: 'Train three times this week.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    schedule: {
      kind: 'quota',
      target: 3,
      periodDays: 7,
      anchor: 'calendarWeek',
    },
  }
}

function createPeriodTargetQuest(
  overrides: {
    id?: string
    target?: number
    periodDays?: number
    createdDate?: string
  } = {},
): Quest {
  const {
    id = 'brush-twice',
    target = 2,
    periodDays = 1,
    createdDate = '2026-08-06',
  } = overrides
  return {
    id,
    emoji: '🪥',
    title: 'Brush Twice',
    description: 'Brush twice today.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    createdDate,
    schedule: {
      kind: 'periodTarget',
      target,
      periodDays,
      anchor: 'questStart',
    },
  }
}

function createState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    startDate: '2026-07-14',
    currentDate: '2026-07-14',
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
