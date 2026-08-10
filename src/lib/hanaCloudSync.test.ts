import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState, Quest } from '@/types'
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

  it('serializes a quota as one period row instead of daily misses', () => {
    const quotaQuest = createQuotaQuest()
    const state = createState({
      startDate: '2026-08-06',
      currentDate: '2026-08-08',
      activeDailyQuests: {
        '2026-08-06': [quotaQuest.id],
        '2026-08-07': [quotaQuest.id],
        '2026-08-08': [quotaQuest.id],
      },
      dailyCompletions: {
        '2026-08-06': { [quotaQuest.id]: true },
        '2026-08-07': { [quotaQuest.id]: true },
      },
    })

    const partial = createHanaCloudSyncPayload('hana', state, [quotaQuest])
    expect(partial.questStatuses).toEqual([
      expect.objectContaining({
        questId: quotaQuest.id,
        periodKey: '2026-08-02',
        dateKey: null,
        windowStart: '2026-08-02',
        dueDate: '2026-08-08',
        status: 'pending',
        flowersEarned: 2,
      }),
    ])

    state.dailyCompletions['2026-08-08'] = { [quotaQuest.id]: true }
    expect(
      createHanaCloudSyncPayload('hana', state, [quotaQuest]).questStatuses,
    ).toEqual([
      expect.objectContaining({
        periodKey: '2026-08-02',
        status: 'completed',
        flowersEarned: 3,
      }),
    ])
  })

  it('serializes a counted period target with reward only after the full goal', () => {
    const quest = createPeriodTargetQuest()
    const state = createState({
      currentDate: '2026-08-06',
      activeDailyQuests: {
        '2026-08-06': [quest.id],
      },
      habitOccurrences: {
        '2026-08-06': { [quest.id]: 1 },
      },
      dailyCompletions: {
        '2026-08-06': { [quest.id]: true },
      },
    })

    expect(createHanaCloudSyncPayload('hana', state, [quest]).questStatuses).toEqual([
      expect.objectContaining({
        questId: quest.id,
        periodKey: '2026-08-06',
        dateKey: null,
        windowStart: '2026-08-06',
        dueDate: '2026-08-06',
        status: 'pending',
        flowersEarned: 0,
      }),
    ])

    state.habitOccurrences['2026-08-06'][quest.id] = 2
    expect(createHanaCloudSyncPayload('hana', state, [quest]).questStatuses).toEqual([
      expect.objectContaining({
        periodKey: '2026-08-06',
        status: 'completed',
        flowersEarned: 1,
      }),
    ])
  })

  it('serializes unresolved paused windows as neutral projection rows', () => {
    const state = createState({
      currentDate: '2026-07-14',
      activeDailyQuests: {
        '2026-07-14': ['morning-dew'],
      },
      activeLongTermQuestIds: ['badminton-boss'],
      longTermWindows: {
        'badminton-boss': '2026-07-14',
      },
      trackingPauses: [
        {
          id: 'pause-cloud',
          startDate: '2026-07-14',
          endDate: '2026-07-14',
          reason: 'illness',
          recordedAt: '2026-07-14T08:00:00.000Z',
        },
      ],
    })

    const rows = createHanaCloudSyncPayload('hana', state, quests).questStatuses

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questId: 'morning-dew', status: 'paused' }),
        expect.objectContaining({ questId: 'badminton-boss', status: 'paused' }),
      ]),
    )
  })
})

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

function createPeriodTargetQuest(): Quest {
  return {
    id: 'brush-twice',
    emoji: '🪥',
    title: 'Brush Twice',
    description: 'Brush twice today.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    createdDate: '2026-08-06',
    schedule: {
      kind: 'periodTarget',
      target: 2,
      periodDays: 1,
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
