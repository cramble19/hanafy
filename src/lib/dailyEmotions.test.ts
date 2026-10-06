import { describe, expect, it } from 'vitest'
import {
  getDailyEmotion,
  normalizeDailyEmotions,
  setDailyEmotion,
  recordRecentEmotion,
} from '@/lib/dailyEmotions'
import {
  createStartedHanaState,
  parseStoredHanaState,
  resetProfileProgress,
} from '@/lib/hanaGame'

describe('daily emotion tracking', () => {
  it('records and replaces a recent emotion without changing any other records', () => {
    const state = { ...createStartedHanaState('2026-10-01'), currentDate: '2026-10-06',
      dailyEmotions: { '2026-10-06': 'good' as const, '2026-10-04': 'low' as const },
      openActivityLogs: { '2026-10-04': { 'open-cramble-gym': 1 } },
      dailyCompletions: { '2026-10-04': { gym: true } } }
    const result = recordRecentEmotion(state, '2026-10-04', 'bright')
    expect(result.error).toBeNull()
    expect(result.state.dailyEmotions).toEqual({ '2026-10-06': 'good', '2026-10-04': 'bright' })
    expect(result.state.openActivityLogs).toBe(state.openActivityLogs)
    expect(result.state.dailyCompletions).toBe(state.dailyCompletions)
    expect(result.state.totalFlowers).toBe(state.totalFlowers)
    expect(recordRecentEmotion(result.state, '2026-10-04', 'bright').state).toBe(result.state)
  })

  it('limits corrections to three previous days, including a month boundary', () => {
    const state = { ...createStartedHanaState('2026-09-01'), currentDate: '2026-10-02' }
    for (const date of ['2026-09-29', '2026-09-30', '2026-10-01']) {
      expect(recordRecentEmotion(state, date, 'okay').error).toBeNull()
    }
    for (const date of ['2026-09-28', '2026-10-02', '2026-10-03', '2026-02-30', 'invalid']) {
      expect(recordRecentEmotion(state, date, 'okay').state).toBe(state)
      expect(recordRecentEmotion(state, date, 'okay').error).toBeTruthy()
    }
    expect(recordRecentEmotion({ ...state, startDate: '2026-10-01' }, '2026-09-30', 'good').error).toBeTruthy()
  })
  it('records and updates one neutral emotion on the current tracker day', () => {
    const state = {
      ...createStartedHanaState('2026-08-10'),
      totalFlowers: 12,
    }
    const low = setDailyEmotion(state, 'low')
    const bright = setDailyEmotion(low, 'bright')

    expect(getDailyEmotion(low)).toBe('low')
    expect(bright.dailyEmotions).toEqual({ '2026-08-10': 'bright' })
    expect(bright.totalFlowers).toBe(12)
    expect(bright.dailyCompletions).toEqual({})
  })

  it('sanitizes malformed dates and emotion values', () => {
    expect(
      normalizeDailyEmotions({
        '2026-08-08': 'okay',
        '2026-02-30': 'good',
        '2026-08-09': 'furious',
        nope: 'bright',
      }),
    ).toEqual({ '2026-08-08': 'okay' })
  })

  it('migrates old snapshots to schema v6 and clears emotions on progress reset', () => {
    const migrated = parseStoredHanaState(
      JSON.stringify({
        ...createStartedHanaState('2026-08-08'),
        schemaVersion: 4,
        dailyEmotions: { '2026-08-08': 'good' },
      }),
      [],
      '2026-08-10',
    )

    expect(migrated.schemaVersion).toBe(8)
    expect(migrated.dailyEmotions).toEqual({ '2026-08-08': 'good' })
    expect(resetProfileProgress(migrated, []).dailyEmotions).toEqual({})
  })
})
