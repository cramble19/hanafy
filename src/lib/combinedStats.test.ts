import { describe, expect, it } from 'vitest'
import type { HanaGameState, Quest } from '@/types'
import { getCombinedStats } from './combinedStats'

describe('combined stats', () => {
  it('uses the common date range and counts saved dated interactions once', () => {
    const quest = dailyQuest('practice', 'Practice')
    const hana = createState({
      startDate: '2026-08-01',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-03': { [quest.id]: false },
      },
      habitOccurrences: {
        '2026-08-04': { [quest.id]: 0 },
      },
      openActivityLogs: {
        '2026-08-06': { 'open-gym': 1 },
      },
      eveningWeeds: {
        '2026-08-05': { 'some-item': false },
        '2026-08-06': {},
      },
      activeDailyQuests: {
        '2026-08-06': [quest.id],
      },
      questSkips: {
        '2026-08-02': {
          [`daily:${quest.id}:2026-08-07`]: true,
          [`daily:${quest.id}:2026-08-08`]: false,
          [`longTerm:${quest.id}:2026-08-06`]: true,
        },
      },
      longTermCompletions: {
        [quest.id]: { '2026-08-06': true },
      },
    })
    const cramble = createState({
      startDate: '2026-08-03',
      currentDate: '2026-08-08',
      dailyCompletions: {
        '2026-08-03': { [quest.id]: true },
        '2026-08-08': { [quest.id]: true },
      },
      habitOccurrences: {
        '2026-08-07': { [quest.id]: 1 },
      },
    })

    const stats = getCombinedStats(hana, [quest], cramble, [quest], 7)

    expect(stats.rangeStart).toBe('2026-08-03')
    expect(stats.rangeEnd).toBe('2026-08-08')
    expect(stats.hana.activeDateKeys).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
    expect(stats.hana.activeDays).toBe(5)
    expect(stats.cramble.activeDateKeys).toEqual([
      '2026-08-03',
      '2026-08-07',
      '2026-08-08',
    ])
    expect(stats.cramble.activeDays).toBe(3)
    expect(stats.sharedActiveDateKeys).toEqual([
      '2026-08-03',
      '2026-08-07',
    ])
    expect(stats.sharedActiveDays).toBe(2)
  })

  it('settles only completed or missed windows beyond the correction grace', () => {
    const daily = dailyQuest('daily', 'Daily practice', '2026-08-01')
    const tenDay = periodQuest('ten-day', 'Ten-day target', 1, 10)
    const state = createState({
      startDate: '2026-08-01',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-01': { [daily.id]: true },
        '2026-08-06': { [daily.id]: true },
        '2026-08-07': { [daily.id]: true },
      },
      habitOccurrences: {
        '2026-08-01': { [tenDay.id]: 1 },
      },
      questSkips: {
        '2026-08-02': {
          [`daily:${daily.id}:2026-08-03`]: true,
        },
      },
      habitSettings: {
        [daily.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: null,
          pauses: [
            {
              id: 'pause-one-day',
              startDate: '2026-08-04',
              endDate: '2026-08-04',
              reason: 'rest',
              recordedAt: '2026-08-04T12:00:00.000Z',
            },
          ],
        },
      },
    })

    const stats = getCombinedStats(
      state,
      [daily, tenDay],
      state,
      [daily, tenDay],
      30,
    )

    expect(stats.hana).toEqual(
      expect.objectContaining({
        settledCompleted: 2,
        settledMissed: 2,
        settledWindows: 4,
        settledRate: 50,
      }),
    )
    expect(stats.hana.strongestHabit).toEqual({
      questId: daily.id,
      title: daily.title,
      rate: 50,
      settledWindows: 4,
    })
  })

  it('chooses the strongest non-archived habit with enough settled evidence', () => {
    const alpha = dailyQuest('alpha', 'Alpha', '2026-08-01')
    const beta = dailyQuest('beta', 'Beta', '2026-08-03')
    const archived = dailyQuest('archived', 'Archived champion', '2026-08-01')
    const state = createState({
      startDate: '2026-08-01',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-01': { [alpha.id]: true, [archived.id]: true },
        '2026-08-02': { [alpha.id]: true, [archived.id]: true },
        '2026-08-03': {
          [alpha.id]: true,
          [beta.id]: true,
          [archived.id]: true,
        },
        '2026-08-04': { [beta.id]: true, [archived.id]: true },
      },
      habitSettings: {
        [archived.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: '2026-08-09',
          pauses: [],
        },
      },
    })

    const stats = getCombinedStats(
      state,
      [alpha, beta, archived],
      state,
      [alpha, beta, archived],
      30,
    )

    expect(stats.hana.strongestHabit).toEqual({
      questId: alpha.id,
      title: alpha.title,
      rate: 50,
      settledWindows: 6,
    })
  })

  it('returns null rates when there are no settled windows', () => {
    const quest = dailyQuest('new', 'New rhythm', '2026-08-08')
    const state = createState({
      startDate: '2026-08-08',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-10': { [quest.id]: true },
      },
    })

    const stats = getCombinedStats(state, [quest], state, [quest], 7)

    expect(stats.hana.settledRate).toBeNull()
    expect(stats.hana.strongestHabit).toBeNull()
    expect(stats.trend).toHaveLength(3)
    expect(stats.trend.every(({ hanaRate }) => hanaRate === null)).toBe(true)
  })

  it('uses adaptive trend buckets and attributes settled windows by end date', () => {
    const quest = dailyQuest('trend', 'Trend', '2026-08-04')
    const hana = createState({
      startDate: '2026-08-04',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-04': { [quest.id]: true },
        '2026-08-06': { [quest.id]: true },
      },
    })
    const cramble = createState({
      startDate: '2026-08-04',
      currentDate: '2026-08-10',
      dailyCompletions: {
        '2026-08-04': { [quest.id]: true },
      },
    })

    const sevenDays = getCombinedStats(hana, [quest], cramble, [quest], 7)
    const thirtyDays = getCombinedStats(
      createState({ startDate: '2026-01-01', currentDate: '2026-08-10' }),
      [],
      createState({ startDate: '2026-01-01', currentDate: '2026-08-10' }),
      [],
      30,
    )
    const ninetyDays = getCombinedStats(
      createState({ startDate: '2026-01-01', currentDate: '2026-08-10' }),
      [],
      createState({ startDate: '2026-01-01', currentDate: '2026-08-10' }),
      [],
      90,
    )

    expect(sevenDays.trend.map(({ hanaRate }) => hanaRate)).toEqual([
      100,
      0,
      100,
      null,
      null,
      null,
      null,
    ])
    expect(sevenDays.trend.map(({ crambleRate }) => crambleRate)).toEqual([
      100,
      0,
      0,
      null,
      null,
      null,
      null,
    ])
    expect(thirtyDays.trend).toHaveLength(5)
    expect(ninetyDays.trend).toHaveLength(6)
  })

  it('scores an x-in-y habit once per settled goal window', () => {
    const quest = {
      ...periodQuest('three-in-ten', 'Three in ten', 3, 10),
      createdDate: '2026-07-01',
    }
    const state = createState({
      startDate: '2026-07-01',
      currentDate: '2026-07-25',
      habitOccurrences: {
        '2026-07-01': { [quest.id]: 2 },
        '2026-07-05': { [quest.id]: 1 },
        '2026-07-12': { [quest.id]: 1 },
        '2026-07-15': { [quest.id]: 1 },
        '2026-07-22': { [quest.id]: 2 },
      },
    })

    const stats = getCombinedStats(state, [quest], state, [quest], 30)

    expect(stats.hana).toEqual(
      expect.objectContaining({
        activeDays: 5,
        settledCompleted: 1,
        settledMissed: 1,
        settledWindows: 2,
        settledRate: 50,
      }),
    )
    expect(stats.hana.strongestHabit).toBeNull()
  })
})

function dailyQuest(id: string, title: string, createdDate?: string): Quest {
  return {
    id,
    emoji: 'D',
    title,
    description: 'Practice once.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    createdDate,
    schedule: { kind: 'daily' },
  }
}

function periodQuest(
  id: string,
  title: string,
  target: number,
  periodDays: number,
): Quest {
  return {
    id,
    emoji: 'P',
    title,
    description: 'Complete the period target.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    createdDate: '2026-08-01',
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
    startDate: '2026-08-01',
    currentDate: '2026-08-10',
    customHabits: [],
    openActivities: [],
    openActivityLogs: {},
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
