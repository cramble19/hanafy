import { describe, expect, it } from 'vitest'
import {
  archiveHabit,
  deleteHabitPermanently,
  getActiveHabitPause,
  getActiveProfilePause,
  isHabitPausedOnDate,
  restoreHabit,
  resumeProfileTracking,
  startHabitPause,
  startProfilePause,
  updateHabitPreferences,
} from './habitLifecycle'
import {
  createStartedHanaState,
  getQuestCatalog,
  parseStoredHanaState,
  recordQuestCompletionForDate,
  recomputeTotalFlowers,
  syncStateToDate,
  toggleQuestCompletion,
  undoQuestCompletionForDate,
} from './hanaGame'
import { createCustomHabitQuest, type NewHabitInput } from './customHabits'
import type { HanaGameState } from '@/types'

const input: NewHabitInput = {
  title: 'Morning water',
  description: 'Drink one glass after waking.',
  frequency: 'oncePerPeriod',
  target: 1,
  periodLength: 1,
  periodUnit: 'days',
  difficulty: 'easy',
  cue: 'After waking',
  reminderTime: '08:00',
}

function createHabitState(date = '2026-08-06') {
  const habit = createCustomHabitQuest(
    input,
    'hana',
    '2026-08-01',
    [],
    'custom-hana-water',
  )
  const state = syncStateToDate(
    {
      ...createStartedHanaState('2026-08-01'),
      currentDate: date,
      customHabits: [habit],
    },
    [],
    date,
  )
  return { state, habit }
}

describe('habit lifecycle and recovery', () => {
  it('stores a profile pause as neutral and allows a same-day clean resume', () => {
    const { state, habit } = createHabitState()
    const paused = startProfilePause(state, {
      reason: 'vacation',
      note: 'Away',
      endDate: null,
    })

    expect(getActiveProfilePause(paused)?.reason).toBe('vacation')
    expect(isHabitPausedOnDate(paused, habit.id)).toBe(true)
    expect(toggleQuestCompletion(paused, habit)).toBe(paused)

    const resumed = resumeProfileTracking(paused)
    expect(getActiveProfilePause(resumed)).toBeNull()
    expect(resumed.trackingPauses).toEqual([])
  })

  it('keeps archived history, converts the inactive gap to a neutral interval on restore, and purges only on delete', () => {
    const { state, habit } = createHabitState('2026-08-02')
    const completed = toggleQuestCompletion(state, habit)
    const withReward: HanaGameState = {
      ...completed,
      totalFlowers: recomputeTotalFlowers(completed, [habit]),
    }
    const archived = archiveHabit(withReward, habit.id)
    const later = { ...archived, currentDate: '2026-08-05' }
    const restored = restoreHabit(later, habit.id)

    expect(restored.totalFlowers).toBe(1)
    expect(getActiveHabitPause(restored, habit.id)).toBeNull()
    expect(isHabitPausedOnDate(restored, habit.id, '2026-08-03')).toBe(true)

    const purged = deleteHabitPermanently(restored, habit.id)
    expect(getQuestCatalog([], purged)).toEqual([])
    expect(purged.dailyCompletions['2026-08-02']?.[habit.id]).toBeUndefined()
    expect(recomputeTotalFlowers(purged, [])).toBe(0)
  })

  it('persists a tombstone when a built-in habit is permanently deleted', () => {
    const builtIn = {
      id: 'built-in-water',
      emoji: 'water',
      title: 'Built-in water',
      description: 'Drink water.',
      group: 'daily' as const,
      difficulty: 'easy' as const,
      color: '#5785a6',
      required: true,
      schedule: { kind: 'daily' as const },
    }
    const started = syncStateToDate(
      createStartedHanaState('2026-08-06'),
      [builtIn],
      '2026-08-06',
    )
    const completed = toggleQuestCompletion(started, builtIn)
    const deleted = deleteHabitPermanently(completed, builtIn.id)
    const reloaded = parseStoredHanaState(
      JSON.stringify(deleted),
      [builtIn],
      '2026-08-06',
    )

    expect(deleted.deletedHabitIds).toContain(builtIn.id)
    expect(getQuestCatalog([builtIn], reloaded)).toEqual([])
    expect(reloaded.dailyCompletions['2026-08-06']?.[builtIn.id]).toBeUndefined()
  })

  it('persists cue/reminder settings and blocks backfill on paused or too-old days', () => {
    const { state, habit } = createHabitState()
    const configured = updateHabitPreferences(state, habit.id, {
      cue: 'After breakfast',
      reminderTime: '09:15',
    })
    expect(configured.habitSettings?.[habit.id]?.reminder).toEqual({
      enabled: true,
      time: '09:15',
    })

    const paused = startHabitPause(
      { ...configured, currentDate: '2026-08-05' },
      habit.id,
      { reason: 'illness', endDate: '2026-08-05' },
    )
    const today = { ...paused, currentDate: '2026-08-06' }
    expect(recordQuestCompletionForDate(today, habit, '2026-08-05').error).toMatch(/paused/i)
    expect(recordQuestCompletionForDate(today, habit, '2026-08-01').error).toMatch(/previous 3 days/i)
  })

  it('restores reminder intent and does not resurrect an open pause after archive', () => {
    const { state, habit } = createHabitState('2026-08-02')
    const configured = updateHabitPreferences(state, habit.id, {
      cue: 'After breakfast',
      reminderTime: '09:15',
    })
    const paused = startHabitPause(configured, habit.id, {
      reason: 'rest',
      endDate: null,
    })
    const archived = archiveHabit(
      { ...paused, currentDate: '2026-08-03' },
      habit.id,
    )
    const restored = restoreHabit(
      { ...archived, currentDate: '2026-08-05' },
      habit.id,
    )

    expect(getActiveHabitPause(restored, habit.id)).toBeNull()
    expect(restored.habitSettings?.[habit.id]?.reminder).toEqual({
      enabled: true,
      time: '09:15',
    })
  })

  it('records a recent completion against the performed date and audits it', () => {
    const { state, habit } = createHabitState()
    const result = recordQuestCompletionForDate(state, habit, '2026-08-05')

    expect(result.error).toBeNull()
    expect(result.state.habitOccurrences['2026-08-05']?.[habit.id]).toBe(1)
    expect(result.state.currentDate).toBe('2026-08-06')
    expect(result.state.backfillAudit?.[0]).toEqual(
      expect.objectContaining({
        habitId: habit.id,
        performedDate: '2026-08-05',
        delta: 1,
      }),
    )
  })

  it('undoes one recent record and audits the correction', () => {
    const { state, habit } = createHabitState()
    const recorded = recordQuestCompletionForDate(state, habit, '2026-08-05')
    const undone = undoQuestCompletionForDate(
      recorded.state,
      habit,
      '2026-08-05',
    )

    expect(undone.error).toBeNull()
    expect(undone.state.habitOccurrences['2026-08-05']?.[habit.id]).toBe(0)
    expect(undone.state.backfillAudit?.at(-1)).toEqual(
      expect.objectContaining({
        habitId: habit.id,
        performedDate: '2026-08-05',
        delta: -1,
      }),
    )
  })

  it('never turns an existing legacy quota record off during backfill', () => {
    const { state, habit } = createHabitState()
    const legacyQuota = {
      ...habit,
      schedule: {
        kind: 'quota' as const,
        target: 2,
        periodDays: 7 as const,
        anchor: 'questStart' as const,
      },
    }
    const alreadyRecorded = {
      ...state,
      dailyCompletions: {
        ...state.dailyCompletions,
        '2026-08-05': { [habit.id]: true },
      },
    }

    const result = recordQuestCompletionForDate(
      alreadyRecorded,
      legacyQuota,
      '2026-08-05',
    )

    expect(result.error).toMatch(/already recorded/i)
    expect(result.state).toBe(alreadyRecorded)
    expect(result.state.dailyCompletions['2026-08-05']?.[habit.id]).toBe(true)
    expect(result.state.backfillAudit).toEqual([])
  })
})
