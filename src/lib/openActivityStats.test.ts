import { describe, expect, it } from 'vitest'
import type { HanaGameState, OpenActivity } from '@/types'
import { getOpenActivityRangeStats } from './openActivityStats'

describe('deadline-free activity statistics', () => {
  it('treats checked days as neutral activity rather than outcomes', () => {
    const activity = createActivity({ kind: 'check' })
    const state = createState(activity, {
      '2026-08-02': { [activity.id]: 1 },
      '2026-08-05': { [activity.id]: 5 },
      '2026-08-08': { [activity.id]: 0 },
    })

    const stats = getOpenActivityRangeStats(state, activity.id, 7)

    expect(stats).toMatchObject({
      rangeStart: '2026-08-02',
      rangeEnd: '2026-08-08',
      total: 2,
      activeDays: 2,
      averagePerActiveDay: 1,
      peakCount: 1,
      lastLoggedDate: '2026-08-05',
      todayCount: 0,
    })
    expect(stats?.days.map(({ active }) => active)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('summarizes numerical amounts and keeps empty days in the range', () => {
    const activity = createActivity({ kind: 'count', unit: 'pages' })
    const state = createState(activity, {
      '2026-08-02': { [activity.id]: 12 },
      '2026-08-04': { [activity.id]: 7.9 },
      '2026-08-08': { [activity.id]: 3 },
    })

    const stats = getOpenActivityRangeStats(state, activity.id, 7)

    expect(stats).toMatchObject({
      total: 22,
      activeDays: 3,
      averagePerActiveDay: 22 / 3,
      peakCount: 12,
      lastLoggedDate: '2026-08-08',
      todayCount: 3,
      weeklyPace: 22,
    })
    expect(stats?.days).toHaveLength(7)
  })

  it('starts all-time history at creation and ignores impossible earlier logs', () => {
    const activity = createActivity({ createdDate: '2026-08-03' })
    const state = {
      ...createState(activity, {
        '2026-08-02': { [activity.id]: 1 },
        '2026-08-10': { [activity.id]: 1 },
        '2026-08-11': { [activity.id]: 1 },
      }),
      startDate: '2026-08-01',
      currentDate: '2026-08-10',
    }

    const stats = getOpenActivityRangeStats(state, activity.id, 'all')

    expect(stats?.rangeStart).toBe('2026-08-03')
    expect(stats?.rangeEnd).toBe('2026-08-10')
    expect(stats?.activeDays).toBe(1)
  })

  it('does not show pre-creation days in a fixed range', () => {
    const activity = createActivity({ createdDate: '2026-08-06' })
    const state = createState(activity, {
      '2026-08-05': { [activity.id]: 1 },
      '2026-08-07': { [activity.id]: 1 },
    })

    const stats = getOpenActivityRangeStats(state, activity.id, 7)

    expect(stats?.rangeStart).toBe('2026-08-06')
    expect(stats?.days).toHaveLength(3)
    expect(stats?.activeDays).toBe(1)
  })

  it('never begins an activity view before the profile started', () => {
    const activity = createActivity({ createdDate: '2026-08-01' })
    const state = {
      ...createState(activity, {
        '2026-08-05': { [activity.id]: 1 },
        '2026-08-07': { [activity.id]: 1 },
      }),
      startDate: '2026-08-06',
    }

    const stats = getOpenActivityRangeStats(state, activity.id, 7)

    expect(stats?.rangeStart).toBe('2026-08-06')
    expect(stats?.activeDays).toBe(1)
  })

  it('freezes archived history and excludes neutral pause days from pace', () => {
    const activity = createActivity({ kind: 'count', unit: 'pages' })
    const state = {
      ...createState(activity, {
        '2026-08-01': { [activity.id]: 7 },
        '2026-08-05': { [activity.id]: 7 },
      }),
      currentDate: '2026-08-20',
      habitSettings: {
        [activity.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: '2026-08-08',
          pauses: [
            {
              id: 'pause-open-pages',
              startDate: '2026-08-02',
              endDate: '2026-08-04',
              reason: 'illness' as const,
              recordedAt: '2026-08-02T12:00:00.000Z',
            },
          ],
        },
      },
    }

    const stats = getOpenActivityRangeStats(state, activity.id, 30)

    expect(stats?.rangeEnd).toBe('2026-08-08')
    expect(stats?.days).toHaveLength(8)
    expect(stats?.total).toBe(14)
    expect(stats?.weeklyPace).toBe(24.5)
  })

  it('returns null for an activity that does not belong to the profile', () => {
    const state = createState(createActivity())
    expect(getOpenActivityRangeStats(state, 'missing', 30)).toBeNull()
  })
})

function createActivity(
  overrides: Partial<OpenActivity> = {},
): OpenActivity {
  return {
    id: 'open-gym',
    title: 'Gym visit',
    description: 'Any movement session counts.',
    color: '#839c72',
    kind: 'check',
    createdDate: '2026-08-01',
    ...overrides,
    custom: true,
    unit: overrides.unit ?? null,
  }
}

function createState(
  activity: OpenActivity,
  logs: HanaGameState['openActivityLogs'] = {},
): HanaGameState {
  return {
    schemaVersion: 3,
    startDate: '2026-08-01',
    currentDate: '2026-08-08',
    customHabits: [],
    deletedHabitIds: [],
    historyEpoch: 'test-history',
    syncRevision: 1,
    habitSettings: {},
    trackingPauses: [],
    backfillAudit: [],
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    habitOccurrences: {},
    openActivities: [activity],
    openActivityLogs: logs,
    dailyEmotions: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
  }
}
