import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import {
  archiveHabit,
  createDefaultHabitSettings,
  startHabitPause,
} from '@/lib/habitLifecycle'
import {
  createInitialHanaState,
  createStartedHanaState,
  parseStoredHanaState,
  resetProfileProgress,
} from '@/lib/hanaGame'
import type { HanaGameState, NewOpenActivityInput, OpenActivity } from '@/types'
import {
  createOpenActivity,
  deleteOpenActivityPermanently,
  getActiveOpenActivities,
  getNewOpenActivityValidationError,
  getOpenActivityDateValidationError,
  getOpenActivitySummary,
  getOpenActivityValue,
  incrementOpenActivityCount,
  incrementOpenActivityCountForDate,
  OPEN_ACTIVITY_LIMITS,
  recordOpenActivityForDate,
  setOpenActivityValue,
  setOpenActivityValueForDate,
  toggleOpenActivityCheck,
  undoOpenActivityForDate,
  updateOpenActivityDefinition,
} from './openActivities'

describe('deadline-free anytime logs', () => {
  it('creates self-describing definitions on the supplied logical day', () => {
    const activity = createOpenActivity(
      input({ kind: 'count', unit: ' pages ' }),
      'hana',
      '2026-08-07',
      [],
      'open-hana-reading',
    )

    expect(activity).toEqual(
      expect.objectContaining({
        id: 'open-hana-reading',
        custom: true,
        kind: 'count',
        unit: 'pages',
        createdDate: '2026-08-07',
      }),
    )
    expect(activity).not.toHaveProperty('emoji')
    expect(activity.color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('validates names, descriptions, units, colors, and duplicate titles', () => {
    expect(
      getNewOpenActivityValidationError(input({ title: '  ' })),
    ).toBe('Give this log a name.')
    expect(
      getNewOpenActivityValidationError(
        input({ kind: 'count', unit: 'x'.repeat(25) }),
      ),
    ).toContain('unit')
    expect(
      getNewOpenActivityValidationError(input({ color: 'red' })),
    ).toContain('color')
    expect(
      getNewOpenActivityValidationError(input(), ['  Gym visit  ']),
    ).toContain('already exists')
  })

  it('can change record kind before the integration-level history lock applies', () => {
    const activity = checkActivity('2026-08-01')
    const updated = updateOpenActivityDefinition(
      activity,
      input({ kind: 'count', unit: 'sets' }),
    )

    expect(updated).toEqual(
      expect.objectContaining({ kind: 'count', unit: 'sets' }),
    )
    expect(updated.id).toBe(activity.id)
    expect(updated.createdDate).toBe(activity.createdDate)
  })

  it('toggles a check only on state.currentDate without changing rewards', () => {
    const activity = checkActivity('2026-08-01')
    const state = withActivity(activity, {
      currentDate: '2026-08-07',
      totalFlowers: 12,
    })

    const logged = toggleOpenActivityCheck(state, activity.id)
    expect(logged.openActivityLogs).toEqual({
      '2026-08-07': { [activity.id]: 1 },
    })
    expect(logged.totalFlowers).toBe(12)
    expect(toggleOpenActivityCheck(logged, activity.id).openActivityLogs).toEqual(
      {},
    )
    expect(setOpenActivityValue(state, activity.id, 2)).toBe(state)
  })

  it('increments counts within a bounded non-negative integer range', () => {
    const activity = countActivity('2026-08-01')
    const state = withActivity(activity)
    const logged = incrementOpenActivityCount(state, activity.id, 3)

    expect(getOpenActivityValue(logged, activity.id)).toBe(3)
    expect(incrementOpenActivityCount(logged, activity.id, -4)).toBe(logged)
    expect(incrementOpenActivityCount(logged, activity.id, 0.5)).toBe(logged)

    const atLimit = setOpenActivityValue(
      state,
      activity.id,
      OPEN_ACTIVITY_LIMITS.dailyCount,
    )
    expect(getOpenActivityValue(atLimit, activity.id)).toBe(999_999)
    expect(incrementOpenActivityCount(atLimit, activity.id, 1)).toBe(atLimit)
    expect(
      setOpenActivityValue(
        state,
        activity.id,
        OPEN_ACTIVITY_LIMITS.dailyCount + 1,
      ),
    ).toBe(state)
  })

  it('stores a bounded one-to-five rating without changing rewards', () => {
    const activity: OpenActivity = {
      id: 'custom-hana-energy-check-in',
      custom: true,
      title: 'Energy level',
      description: 'How was your energy today?',
      color: '#9fb683',
      kind: 'rating',
      unit: null,
      createdDate: '2026-08-01',
    }
    const state = withActivity(activity, { totalFlowers: 9 })
    const rated = setOpenActivityValue(state, activity.id, 4)

    expect(getOpenActivityValue(rated, activity.id)).toBe(4)
    expect(rated.totalFlowers).toBe(9)
    expect(setOpenActivityValue(rated, activity.id, 6)).toBe(rated)
  })

  it('allows recent-day correction but rejects old, future, pre-start, and neutral days', () => {
    const activity = countActivity('2026-08-02')
    const state = withActivity(activity, {
      startDate: '2026-08-01',
      currentDate: '2026-08-08',
    })

    const corrected = incrementOpenActivityCountForDate(
      state,
      activity.id,
      '2026-08-05',
      2,
    )
    expect(getOpenActivityValue(corrected, activity.id, '2026-08-05')).toBe(2)
    expect(
      setOpenActivityValueForDate(corrected, activity.id, '2026-08-05', 0)
        .openActivityLogs,
    ).toEqual({})

    expect(
      getOpenActivityDateValidationError(state, activity.id, '2026-08-04'),
    ).toContain('previous 3 days')
    expect(
      getOpenActivityDateValidationError(state, activity.id, '2026-08-09'),
    ).toContain('Future')
    expect(
      getOpenActivityDateValidationError(state, activity.id, '2026-07-31'),
    ).toContain('tracker began')

    const neutralState = {
      ...state,
      habitSettings: {
        [activity.id]: {
          ...createDefaultHabitSettings(),
          pauses: [
            {
              id: 'pause-test',
              startDate: '2026-08-06',
              endDate: '2026-08-06',
              reason: 'illness' as const,
              recordedAt: '2026-08-06T12:00:00.000Z',
            },
          ],
        },
      },
    }
    expect(
      setOpenActivityValueForDate(
        neutralState,
        activity.id,
        '2026-08-06',
        1,
      ),
    ).toBe(neutralState)
  })

  it('audits recent-day record and undo corrections', () => {
    const activity = countActivity('2026-08-01')
    const state = withActivity(activity)

    const recorded = recordOpenActivityForDate(
      state,
      activity.id,
      '2026-08-07',
    )
    expect(recorded.error).toBeNull()
    expect(getOpenActivityValue(recorded.state, activity.id, '2026-08-07')).toBe(1)
    expect(recorded.state.backfillAudit).toEqual([
      expect.objectContaining({
        habitId: activity.id,
        performedDate: '2026-08-07',
        delta: 1,
      }),
    ])

    const undone = undoOpenActivityForDate(
      recorded.state,
      activity.id,
      '2026-08-07',
    )
    expect(undone.error).toBeNull()
    expect(getOpenActivityValue(undone.state, activity.id, '2026-08-07')).toBe(0)
    expect(undone.state.backfillAudit?.map((event) => event.delta)).toEqual([
      1,
      -1,
    ])
  })

  it('uses shared pause and archive lifecycle settings', () => {
    const activity = checkActivity('2026-08-01')
    const state = withActivity(activity)
    const paused = startHabitPause(state, activity.id, {
      reason: 'illness',
    })
    expect(toggleOpenActivityCheck(paused, activity.id)).toBe(paused)

    const archived = archiveHabit(state, activity.id)
    expect(getActiveOpenActivities(archived)).toEqual([])
    expect(toggleOpenActivityCheck(archived, activity.id)).toBe(archived)
  })

  it('summarizes only recorded days and leaves blank days neutral', () => {
    const activity = countActivity('2026-08-01')
    const state = withActivity(activity, {
      openActivityLogs: {
        '2026-08-02': { [activity.id]: 4 },
        '2026-08-04': { [activity.id]: 8 },
      },
    })

    expect(getOpenActivitySummary(state, activity.id)).toEqual({
      total: 12,
      activeDays: 2,
      averagePerActiveDay: 6,
      lastLoggedDate: '2026-08-04',
    })
  })

  it('permanently deletes its definition, history, and lifecycle settings', () => {
    const activity = checkActivity('2026-08-01')
    const state = withActivity(activity, {
      habitSettings: {
        [activity.id]: createDefaultHabitSettings(),
      },
      openActivityLogs: {
        '2026-08-08': { [activity.id]: 1, 'open-hana-other': 2 },
      },
      backfillAudit: [
        {
          id: 'backfill-open-delete',
          habitId: activity.id,
          performedDate: '2026-08-07',
          recordedAt: '2026-08-08T10:00:00.000Z',
          delta: 1,
        },
      ],
    })

    const deleted = deleteOpenActivityPermanently(state, activity.id)
    expect(deleted.openActivities).toEqual([])
    expect(deleted.openActivityLogs).toEqual({
      '2026-08-08': { 'open-hana-other': 2 },
    })
    expect(deleted.habitSettings?.[activity.id]).toBeUndefined()
    expect(deleted.backfillAudit).toEqual([])
    expect(deleted.deletedHabitIds).toContain(activity.id)
  })

  it('resets progress while preserving definitions and lifecycle intent', () => {
    const activity = countActivity('2026-08-01')
    const state = withActivity(activity, {
      openActivityLogs: { '2026-08-08': { [activity.id]: 5 } },
      habitSettings: {
        [activity.id]: createDefaultHabitSettings(),
      },
    })

    const reset = resetProfileProgress(state, [])
    expect(reset.openActivities).toEqual([activity])
    expect(reset.openActivities).not.toBe(state.openActivities)
    expect(reset.openActivityLogs).toEqual({})
    expect(reset.habitSettings?.[activity.id]).toBeDefined()
  })

  it('migrates schema v2 snapshots and sanitizes malformed v3 open logs', () => {
    const legacy = parseStoredHanaState(
      JSON.stringify({
        ...createInitialHanaState(),
        schemaVersion: 2,
        currentDate: '2026-08-07',
        dailyCompletions: { '2026-08-07': { legacy: true } },
        openActivities: undefined,
        openActivityLogs: undefined,
      }),
      [],
      '2026-08-08',
    )
    expect(legacy.schemaVersion).toBe(7)
    expect(legacy.openActivities).toEqual([])
    expect(legacy.openActivityLogs).toEqual({})
    expect(legacy.dailyCompletions['2026-08-07']?.legacy).toBe(true)

    const check = checkActivity('2026-08-02')
    const count = countActivity('2026-08-02')
    const deleted = { ...check, id: 'open-hana-deleted', title: 'Deleted log' }
    const normalized = parseStoredHanaState(
      JSON.stringify({
        ...createInitialHanaState(),
        currentDate: '2026-08-08',
        deletedHabitIds: [deleted.id],
        openActivities: [
          check,
          count,
          deleted,
          { ...count, id: 'invalid', title: 'Bad id' },
        ],
        openActivityLogs: {
          '2026-08-01': { [count.id]: 3 },
          '2026-08-05': {
            [check.id]: 2,
            [count.id]: 7,
            [deleted.id]: 1,
            unknown: 8,
          },
          '2026-08-06': {
            [check.id]: 1,
            [count.id]: OPEN_ACTIVITY_LIMITS.dailyCount + 1,
          },
        },
      }),
      [],
      '2026-08-08',
    )

    expect(normalized.openActivities).toEqual([check, count])
    expect(normalized.openActivityLogs).toEqual({
      '2026-08-05': { [count.id]: 7 },
      '2026-08-06': { [check.id]: 1 },
    })
  })

  it('removes unapproved Hana defaults and migrates energy to a five-point rating', () => {
    const oldDefaults = [
      ['custom-hana-kind-moment', 'Kind Moment', 'check'],
      ['custom-hana-music-moment', 'Music Moment', 'check'],
      ['custom-hana-energy-check-in', 'Energy Check-in', 'count'],
      ['custom-hana-mindful-treat', 'Mindful Treat', 'check'],
    ].map(([id, title, kind]) => ({
      id,
      custom: true,
      title,
      description: `${title} description`,
      emoji: '•',
      color: '#9fb683',
      kind: kind as OpenActivity['kind'],
      unit: kind === 'count' ? 'energy point' : null,
      createdDate: '2026-08-01',
    }))
    const migrated = parseStoredHanaState(
      JSON.stringify({
        ...createStartedHanaState('2026-08-01'),
        schemaVersion: 4,
        currentDate: '2026-08-10',
        openActivities: oldDefaults,
        openActivityLogs: {
          '2026-08-09': Object.fromEntries(
            oldDefaults.map((activity) => [activity.id, activity.kind === 'count' ? 9 : 1]),
          ),
        },
      }),
      quests,
      '2026-08-10',
    )

    expect(migrated.openActivities.map(({ id }) => id)).toEqual([
      'custom-hana-energy-check-in',
      'custom-hana-productive-day',
    ])
    expect(migrated.openActivities[0]).toEqual(
      expect.objectContaining({
        title: 'Energy level',
        kind: 'rating',
        createdDate: '2026-08-01',
      }),
    )
    expect(migrated.openActivityLogs).toEqual({
      '2026-08-09': { 'custom-hana-energy-check-in': 5 },
    })
  })
})

function input(
  overrides: Partial<NewOpenActivityInput> = {},
): NewOpenActivityInput {
  return {
    title: 'Gym visit',
    description: 'Any movement session counts.',
    kind: 'check',
    ...overrides,
  }
}

function checkActivity(createdDate: string): OpenActivity {
  return createOpenActivity(
    input(),
    'hana',
    createdDate,
    [],
    'open-hana-gym',
  )
}

function countActivity(createdDate: string): OpenActivity {
  return createOpenActivity(
    input({ title: 'Pages read', kind: 'count', unit: 'pages' }),
    'hana',
    createdDate,
    [],
    'open-hana-pages',
  )
}

function withActivity(
  activity: OpenActivity,
  overrides: Partial<HanaGameState> = {},
): HanaGameState {
  return {
    ...createStartedHanaState('2026-08-01'),
    currentDate: '2026-08-08',
    openActivities: [activity],
    ...overrides,
  }
}
