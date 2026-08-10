import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import type { HanaGameState, Quest } from '@/types'
import {
  activateQuest,
  addDays,
  createStartedHanaState,
  getAvailableQuestsForState,
  parseStoredHanaState,
  recomputeTotalFlowers,
  syncActiveQuestPlan,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import {
  isHabitGraduatedOnDate,
  getHabitSettings,
  restoreGraduatedHabit,
} from '@/lib/habitLifecycle'
import {
  getQuestCompletionProgress,
  reconcileQuestGraduation,
} from '@/lib/questCompletion'

describe('finite quest chapters', () => {
  it('migrates v3 progress to v5 without changing records or earned rewards', () => {
    const customQuest = {
      ...dailyQuest({ id: 'custom-hana-legacy-practice' }),
      custom: true as const,
      createdDate: '2026-08-01',
      required: true as const,
      minLevel: 1 as const,
    }
    const original = {
      ...createStartedHanaState('2026-08-01'),
      schemaVersion: 3,
      currentDate: '2026-08-02',
      customHabits: [customQuest],
      dailyCompletions: {
        '2026-08-01': { [customQuest.id]: true },
      },
      totalFlowers: 1,
    }
    const migrated = parseStoredHanaState(
      JSON.stringify(original),
      [],
      '2026-08-02',
    )

    expect(migrated.schemaVersion).toBe(5)
    expect(migrated.dailyCompletions).toEqual(original.dailyCompletions)
    expect(migrated.customHabits[0].completionCriteria).toBeDefined()
    expect(getHabitSettings(migrated, customQuest.id).completion).toEqual(
      expect.objectContaining({ graduation: null, history: [] }),
    )
    expect(recomputeTotalFlowers(migrated, [])).toBe(1)
  })

  it('counts skipped periods as neutral while a finalized miss resets a combo', () => {
    const quest = dailyQuest({
      completionCriteria: {
        paths: [
          { kind: 'combo', target: 3 },
          { kind: 'totalSuccesses', target: 5 },
        ],
      },
    })
    const neutralState = stateForQuest(quest, '2026-08-04', {
      completions: ['2026-08-01', '2026-08-03', '2026-08-04'],
      skipped: ['2026-08-02'],
    })
    const neutralProgress = getQuestCompletionProgress(
      neutralState,
      [quest],
      'hana',
      quest,
    )

    expect(neutralProgress.paths[0]).toEqual(
      expect.objectContaining({ kind: 'combo', current: 3, isMet: true }),
    )

    const missedState = stateForQuest(quest, '2026-08-10', {
      completions: ['2026-08-01', '2026-08-05', '2026-08-06'],
    })
    expect(
      getQuestCompletionProgress(missedState, [quest], 'hana', quest).paths[0],
    ).toEqual(
      expect.objectContaining({ kind: 'combo', current: 2, isMet: false }),
    )
  })

  it('does not bridge a combo across an unresolved correction-day gap', () => {
    const quest = dailyQuest({
      completionCriteria: { paths: [{ kind: 'combo', target: 3 }] },
    })
    const state = stateForQuest(quest, '2026-08-03', {
      completions: ['2026-08-01', '2026-08-03'],
    })

    expect(
      getQuestCompletionProgress(state, [quest], 'hana', quest).paths[0],
    ).toEqual(
      expect.objectContaining({ current: 1, isMet: false }),
    )
  })

  it('blooms on the next tracker day, supports a pre-bloom undo, and restores fresh', () => {
    const quest = dailyQuest({
      completionCriteria: {
        paths: [{ kind: 'totalSuccesses', target: 3 }],
      },
    })
    const complete = stateForQuest(quest, '2026-08-03', {
      completions: ['2026-08-01', '2026-08-02', '2026-08-03'],
    })
    const pending = reconcileQuestGraduation(
      complete,
      [quest],
      'hana',
      quest,
    )

    expect(
      pending.habitSettings?.[quest.id]?.completion?.graduation,
    ).toEqual(
      expect.objectContaining({
        achievedDate: '2026-08-03',
        effectiveDate: '2026-08-04',
      }),
    )
    expect(isHabitGraduatedOnDate(pending, quest.id)).toBe(false)

    const undone = reconcileQuestGraduation(
      {
        ...pending,
        dailyCompletions: {
          ...pending.dailyCompletions,
          '2026-08-03': { [quest.id]: false },
        },
      },
      [quest],
      'hana',
      quest,
    )
    expect(
      undone.habitSettings?.[quest.id]?.completion?.graduation,
    ).toBeNull()

    const bloomed = { ...pending, currentDate: '2026-08-04' }
    expect(isHabitGraduatedOnDate(bloomed, quest.id)).toBe(true)
    const planned = syncActiveQuestPlan(bloomed, [quest])
    expect(visibleQuestsForState([quest], planned).daily).toEqual([])

    const restored = restoreGraduatedHabit(planned, quest.id)
    expect(
      restored.habitSettings?.[quest.id]?.completion?.cycleStartedOn,
    ).toBe('2026-08-04')
    const nextDay = syncActiveQuestPlan({
      ...restored,
      currentDate: '2026-08-05',
    }, [quest])
    expect(visibleQuestsForState([quest], nextDay).daily.map(({ id }) => id))
      .toContain(quest.id)
    expect(
      getQuestCompletionProgress(nextDay, [quest], 'hana', quest).isMet,
    ).toBe(false)
  })

  it('counts a multi-record goal as one success only after its target is met', () => {
    const quest = dailyQuest({
      createdDate: '2026-08-01',
      schedule: {
        kind: 'periodTarget',
        target: 2,
        periodDays: 1,
        anchor: 'questStart',
      },
      completionCriteria: {
        paths: [{ kind: 'totalSuccesses', target: 2 }],
      },
    })
    const firstOnly = stateForQuest(quest, '2026-08-02', {
      occurrences: {
        '2026-08-01': 2,
        '2026-08-02': 1,
      },
    })
    expect(
      getQuestCompletionProgress(firstOnly, [quest], 'hana', quest).paths[0],
    ).toEqual(expect.objectContaining({ current: 1, isMet: false }))

    const both = {
      ...firstOnly,
      habitOccurrences: {
        ...firstOnly.habitOccurrences,
        '2026-08-02': { [quest.id]: 2 },
      },
    }
    expect(
      getQuestCompletionProgress(both, [quest], 'hana', quest).paths[0],
    ).toEqual(expect.objectContaining({ current: 2, isMet: true }))
  })

  it('keeps unlocked quests available until Hana adds one for the next tracker day', () => {
    const today = syncActiveQuestPlan(
      { ...createStartedHanaState('2026-08-10'), totalFlowers: 5 },
      quests,
    )
    const available = getAvailableQuestsForState(quests, today)
    const tinyStretch = available.find(({ id }) => id === 'tiny-stretch')
    expect(tinyStretch).toBeDefined()

    const pending = activateQuest(today, tinyStretch!)
    expect(pending.questActivations?.['tiny-stretch']).toBe('2026-08-11')
    expect(visibleQuestsForState(quests, syncActiveQuestPlan(pending, quests)).daily)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'tiny-stretch' })]))

    const tomorrow = syncActiveQuestPlan({
      ...pending,
      currentDate: addDays(pending.currentDate, 1),
    }, quests)
    expect(visibleQuestsForState(quests, tomorrow).daily.map(({ id }) => id))
      .toContain('tiny-stretch')
  })
})

function dailyQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'gentle-practice',
    emoji: '🌱',
    title: 'Gentle Practice',
    description: 'Practice once.',
    group: 'daily',
    difficulty: 'easy',
    color: '#78ab63',
    required: true,
    minLevel: 1,
    schedule: { kind: 'daily' },
    ...overrides,
  }
}

function stateForQuest(
  quest: Quest,
  currentDate: string,
  records: {
    completions?: string[]
    skipped?: string[]
    occurrences?: Record<string, number>
  } = {},
): HanaGameState {
  const startDate = '2026-08-01'
  const dates: string[] = []
  for (let dateKey = startDate; dateKey <= currentDate; dateKey = addDays(dateKey, 1)) {
    dates.push(dateKey)
  }
  return {
    schemaVersion: 5,
    startDate,
    currentDate,
    customHabits: [],
    questActivations: { [quest.id]: startDate },
    openActivities: [],
    openActivityLogs: {},
    dailyEmotions: {},
    habitSettings: {},
    trackingPauses: [],
    activeDailyQuests: Object.fromEntries(
      dates.map((dateKey) => [dateKey, [quest.id]]),
    ),
    activeLongTermQuestIds: [],
    dailyCompletions: Object.fromEntries(
      (records.completions ?? []).map((dateKey) => [
        dateKey,
        { [quest.id]: true },
      ]),
    ),
    habitOccurrences: Object.fromEntries(
      Object.entries(records.occurrences ?? {}).map(([dateKey, count]) => [
        dateKey,
        { [quest.id]: count },
      ]),
    ),
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {
      '2026-08-02': Object.fromEntries(
        (records.skipped ?? []).map((dateKey) => [
          `daily:${quest.id}:${dateKey}`,
          true,
        ]),
      ),
    },
    eveningWeeds: {},
    totalFlowers: 0,
  }
}
