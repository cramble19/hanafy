import { describe, expect, it } from 'vitest'
import {
  getDailyEmotion,
  normalizeDailyEmotions,
  setDailyEmotion,
} from '@/lib/dailyEmotions'
import {
  createStartedHanaState,
  parseStoredHanaState,
  resetProfileProgress,
} from '@/lib/hanaGame'

describe('daily emotion tracking', () => {
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

    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.dailyEmotions).toEqual({ '2026-08-08': 'good' })
    expect(resetProfileProgress(migrated, []).dailyEmotions).toEqual({})
  })
})
