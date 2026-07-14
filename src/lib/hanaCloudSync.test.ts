import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState } from '@/types'
import { createHanaCloudSyncPayload } from './hanaCloudSync'

describe('Hana cloud sync payload', () => {
  it('serializes completed, skipped, pending, and weed rows for Hana', () => {
    const state = createState({
      currentDate: '2026-07-14',
      activeDailyQuests: {
        '2026-07-14': ['morning-dew', 'sun-catch', 'remember-cramble'],
      },
      dailyCompletions: {
        '2026-07-14': {
          'morning-dew': true,
        },
      },
      activeLongTermQuestIds: ['badminton-boss'],
      longTermWindows: {
        'badminton-boss': '2026-07-14',
      },
      questSkips: {
        '2026-07-12': {
          'daily:sun-catch:2026-07-14': true,
        },
      },
      eveningWeeds: {
        '2026-07-14': {
          'scroll-fog': true,
        },
      },
      totalFlowers: 1,
    })

    const payload = createHanaCloudSyncPayload(
      'hana',
      state,
      quests,
      '2026-07-14T08:00:00.000Z',
    )

    expect(payload.profileId).toBe('hana')
    expect(payload.currentDate).toBe('2026-07-14')
    expect(payload.totalFlowers).toBe(1)
    expect(payload.state).toBe(state)
    expect(payload.questStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questGroup: 'daily',
          questId: 'morning-dew',
          periodKey: '2026-07-14',
          status: 'completed',
          flowersEarned: 1,
        }),
        expect.objectContaining({
          questGroup: 'daily',
          questId: 'sun-catch',
          periodKey: '2026-07-14',
          status: 'skipped',
          flowersEarned: 0,
        }),
        expect.objectContaining({
          questGroup: 'daily',
          questId: 'remember-cramble',
          periodKey: '2026-07-14',
          status: 'pending',
          flowersEarned: 0,
        }),
        expect.objectContaining({
          questGroup: 'longTerm',
          questId: 'badminton-boss',
          periodKey: '2026-07-14',
          dueDate: '2026-07-17',
          status: 'pending',
        }),
      ]),
    )
    expect(payload.weedStatuses).toEqual([
      {
        profileId: 'hana',
        dateKey: '2026-07-14',
        weedId: 'scroll-fog',
        checked: true,
      },
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
