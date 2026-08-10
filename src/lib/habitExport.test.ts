import { describe, expect, it } from 'vitest'
import {
  buildProfileBackup,
  buildProfileCsv,
  buildProfileJson,
} from './habitExport'
import { createCustomHabitQuest, type NewHabitInput } from './customHabits'
import { createStartedHanaState } from './hanaGame'
import {
  startHabitPause,
  updateHabitPreferences,
  updateHabitWording,
} from './habitLifecycle'
import type { Quest } from '@/types'
import { createOpenActivity } from './openActivities'

describe('CSV habit export', () => {
  it('exports one profile with periods, occurrences, pauses, and spreadsheet-safe user text', () => {
    const input: NewHabitInput = {
      title: '=SUM(A1:A2)',
      description: 'A title that must not become a formula.',
      frequency: 'timesPerPeriod',
      target: 2,
      periodLength: 1,
      periodUnit: 'days',
      difficulty: 'medium',
    }
    const habit = createCustomHabitQuest(
      input,
      'hana',
      '2026-08-05',
      [],
      'custom-hana-export',
    )
    const base = {
      ...createStartedHanaState('2026-08-05'),
      currentDate: '2026-08-06',
      customHabits: [habit],
      habitOccurrences: {
        '2026-08-05': { [habit.id]: 2 },
      },
      trackingPauses: [
        {
          id: 'pause-export',
          startDate: '2026-08-06',
          endDate: '2026-08-06',
          reason: 'vacation' as const,
          recordedAt: '2026-08-06T08:00:00.000Z',
        },
      ],
    }
    const configured = updateHabitPreferences(base, habit.id, {
      cue: 'After breakfast, before work',
      reminderTime: '08:30',
    })
    const state = startHabitPause(configured, habit.id, {
      reason: 'illness',
      note: 'Recovering',
      endDate: '2026-08-06',
    })

    const csv = buildProfileCsv(state, [], 'hana')

    expect(csv).toContain('"hana"')
    expect(csv).not.toContain('"cramble"')
    expect(csv).toContain('profile,tracking_day_start,record_type')
    expect(csv).toContain('"04:00 local"')
    expect(csv).toContain("\"'=SUM(A1:A2)\"")
    expect(csv).toContain('"After breakfast, before work"')
    expect(csv).toContain('"profile_pause"')
    expect(csv).toContain('"habit_pause"')
    expect(csv).toContain('"vacation"')
    expect(csv).toContain('"Recovering"')
    expect(csv).toContain('"occurrence"')
  })

  it('exports every earned point for a legacy quota period', () => {
    const quest: Quest = {
      id: 'legacy-quota',
      emoji: 'sword',
      title: 'Training',
      description: 'Train three times.',
      group: 'daily',
      difficulty: 'easy',
      color: '#6f8465',
      required: true,
      schedule: {
        kind: 'quota',
        target: 3,
        periodDays: 7,
        anchor: 'calendarWeek',
      },
    }
    const state = {
      ...createStartedHanaState('2026-08-02'),
      currentDate: '2026-08-08',
      dailyCompletions: {
        '2026-08-02': { [quest.id]: true },
        '2026-08-03': { [quest.id]: true },
        '2026-08-04': { [quest.id]: true },
      },
    }

    const periodRow = buildProfileCsv(state, [quest], 'hana')
      .split('\r\n')
      .find((row) => row.includes('"period"') && row.includes('"legacy-quota"'))

    expect(periodRow).toContain('"3","","3","completed","easy","3"')
  })

  it('exports every backfill add and undo event even when the final count is zero', () => {
    const habit = createCustomHabitQuest(
      {
        title: 'Evening walk',
        description: 'Walk around the block.',
        frequency: 'oncePerPeriod',
        target: 1,
        periodLength: 1,
        periodUnit: 'days',
        difficulty: 'easy',
      },
      'hana',
      '2026-08-05',
      [],
      'custom-audit-export',
    )
    const state = {
      ...createStartedHanaState('2026-08-05'),
      currentDate: '2026-08-06',
      customHabits: [habit],
      backfillAudit: [
        {
          id: 'add-event',
          habitId: habit.id,
          performedDate: '2026-08-05',
          recordedAt: '2026-08-06T09:00:00.000Z',
          delta: 1 as const,
        },
        {
          id: 'undo-event',
          habitId: habit.id,
          performedDate: '2026-08-05',
          recordedAt: '2026-08-06T09:05:00.000Z',
          delta: -1 as const,
        },
      ],
    }

    const auditRows = buildProfileCsv(state, [], 'hana')
      .split('\r\n')
      .filter((row) => row.includes('"backfill_event"'))

    expect(auditRows).toHaveLength(2)
    expect(auditRows[0]).toContain('"added"')
    expect(auditRows[0]).toContain('"1"')
    expect(auditRows[1]).toContain('"undone"')
    expect(auditRows[1]).toContain('"-1"')
  })

  it('exports deadline-free definitions and logs without rewards or outcome states', () => {
    const check = createOpenActivity(
      {
        title: 'Gym visit',
        description: 'Any movement session counts.',
        kind: 'check',
      },
      'cramble',
      '2026-08-01',
      [],
      'open-cramble-gym',
    )
    const count = createOpenActivity(
      {
        title: 'Pages read',
        description: 'Record pages completed.',
        kind: 'count',
        unit: '=pages',
      },
      'cramble',
      '2026-08-01',
      [check.title],
      'open-cramble-pages',
    )
    const state = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-03',
      totalFlowers: 12,
      openActivities: [check, count],
      openActivityLogs: {
        '2026-08-01': { [check.id]: 1, [count.id]: 12 },
        '2026-08-03': { [count.id]: 8 },
      },
      habitSettings: {
        [check.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: null,
          pauses: [
            {
              id: 'pause-open-check',
              startDate: '2026-08-02',
              endDate: '2026-08-02',
              reason: 'illness' as const,
              note: 'Rested',
              recordedAt: '2026-08-02T06:00:00.000Z',
            },
          ],
        },
      },
      backfillAudit: [
        {
          id: 'backfill-open-count',
          habitId: count.id,
          performedDate: '2026-08-01',
          recordedAt: '2026-08-03T08:00:00.000Z',
          delta: 1 as const,
        },
      ],
    }

    const csv = buildProfileCsv(state, [], 'cramble')
    const rows = csv.split('\r\n')
    const definitionRows = rows.filter((row) => row.includes('"anytime_activity"'))
    const logRows = rows.filter((row) => row.includes('"anytime_log"'))

    expect(definitionRows).toHaveLength(2)
    expect(logRows).toHaveLength(3)
    expect(csv).toContain('"anytime","check"')
    expect(csv).toContain('"anytime","count","\'=pages"')
    expect(logRows.every((row) => row.includes('"logged"'))).toBe(true)
    expect(logRows.every((row) => row.includes('"0"'))).toBe(true)
    expect(csv).toContain('"habit_pause"')
    expect(csv).toContain('"illness","Rested"')
    expect(csv).toContain('"backfill_event"')
    expect(csv).toContain('"2026-08-03T08:00:00.000Z","true","1"')
    expect(csv).not.toContain('"completed"')
    expect(csv).not.toContain('"missed"')
  })

  it('exports the optional daily emotion as a neutral profile record', () => {
    const state = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-03',
      dailyEmotions: {
        '2026-08-02': 'bright' as const,
      },
    }

    const emotionRow = buildProfileCsv(state, [], 'hana')
      .split('\r\n')
      .find((row) => row.includes('"daily_emotion"'))

    expect(emotionRow).toContain('"emotion","emotion"')
    expect(emotionRow).toContain('"2026-08-02"')
    expect(emotionRow).toContain('"bright:Bright"')
    expect(emotionRow).toContain('"logged"')
  })
})

describe('JSON profile backup', () => {
  it('embeds the effective habit catalog and keeps server revision out of restorable state', () => {
    const builtIn: Quest = {
      id: 'water',
      emoji: '💧',
      title: 'Drink water',
      description: 'Have water after waking.',
      group: 'daily',
      difficulty: 'easy',
      color: '#6f8465',
      required: true,
      schedule: { kind: 'daily' },
    }
    const wordedState = updateHabitWording(
      {
        ...createStartedHanaState('2026-08-05'),
        currentDate: '2026-08-07',
        syncRevision: 17,
        totalFlowers: 9,
        deletedHabitIds: ['retired-built-in'],
      },
      builtIn.id,
      { title: 'First glass', description: 'Drink one glass after waking.' },
    )
    const state = updateHabitPreferences(
      wordedState,
      builtIn.id,
      { cue: 'After getting out of bed', reminderTime: '08:00' },
    )

    const backup = buildProfileBackup(state, [builtIn], 'cramble', {
      exportedAt: '2026-08-07T12:00:00.000Z',
      timeZone: 'Asia/Calcutta',
    })

    expect(backup.format).toBe('hanafy-profile-backup')
    expect(backup.formatVersion).toBe(4)
    expect(backup.profile).toEqual({
      id: 'cramble',
      name: 'Cramble',
      rewardUnit: 'renown',
    })
    expect(backup.trackingClock).toEqual({
      dayStartsAt: '04:00',
      timeZone: 'Asia/Calcutta',
    })
    expect(backup.source.databaseRevision).toBe(17)
    expect(backup.source.logicalDate).toBe('2026-08-07')
    expect(backup.catalog.habits[0]).toMatchObject({
      id: 'water',
      title: 'First glass',
      description: 'Drink one glass after waking.',
      lifecycle: 'active',
    })
    expect(backup.catalog.anytimeActivities).toEqual([])
    expect('syncRevision' in backup.state).toBe(false)
    expect(backup.state.deletedHabitIds).toEqual(['retired-built-in'])

    const parsed = JSON.parse(
      buildProfileJson(state, [builtIn], 'cramble', {
        exportedAt: '2026-08-07T12:00:00.000Z',
        timeZone: 'Asia/Calcutta',
      }),
    ) as typeof backup
    expect(parsed).toEqual(backup)
  })

  it('keeps anytime definitions and their complete dated history', () => {
    const activity = createOpenActivity(
      {
        title: 'Training hall',
        description: 'Record any gym session.',
        kind: 'check',
      },
      'cramble',
      '2026-08-01',
      [],
      'open-cramble-training',
    )
    const state = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-04',
      syncRevision: 8,
      openActivities: [activity],
      openActivityLogs: {
        '2026-08-01': { [activity.id]: 1 },
        '2026-08-04': { [activity.id]: 1 },
      },
    }

    const backup = buildProfileBackup(state, [], 'cramble', {
      exportedAt: '2026-08-04T12:00:00.000Z',
      timeZone: 'Asia/Calcutta',
    })

    expect(backup.catalog.anytimeActivities).toEqual([
      expect.objectContaining({
        id: activity.id,
        kind: 'check',
        lifecycle: 'active',
      }),
    ])
    expect(backup.state.openActivities).toEqual([activity])
    expect(backup.state.openActivityLogs).toEqual(state.openActivityLogs)
    expect(backup.source.databaseRevision).toBe(8)
  })
})
