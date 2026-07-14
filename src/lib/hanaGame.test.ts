import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState } from '@/types'
import {
  getLongTermQuestStatus,
  getSkipProgress,
  parseStoredHanaState,
  syncStateToDate,
  visibleQuestsForState,
} from './hanaGame'

describe('Hana game date sync', () => {
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
      activeLongTermQuestIds: ['badminton-boss'],
      longTermWindows: {
        'badminton-boss': '2026-07-07',
      },
    })

    const syncedState = syncStateToDate(oldState, quests, '2026-07-13')
    const quest = quests.find((item) => item.id === 'badminton-boss')

    expect(quest).toBeDefined()
    expect(syncedState.longTermWindows['badminton-boss']).toBe('2026-07-13')
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
})

function createSavedState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    startDate: '2026-07-07',
    currentDate: '2026-07-07',
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
