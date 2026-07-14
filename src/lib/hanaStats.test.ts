import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState } from '@/types'
import { getCalendarWindow, getHanaStats, getQuestHistory, getWeedHistory } from './hanaStats'

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
    expect(stats.missed).toBe(1)
    expect(stats.open).toBe(1)
    expect(stats.completionRate).toBe(25)
    expect(stats.skipRate).toBe(25)
    expect(stats.needsLove[0]?.questId).toBe('sun-catch')
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
})

function createState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    currentDate: '2026-07-14',
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
    ...overrides,
  }
}
