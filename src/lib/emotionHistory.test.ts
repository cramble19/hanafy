import { describe, expect, it } from 'vitest'
import { createStartedHanaState } from '@/lib/hanaGame'
import {
  EMOTIONS_BEST_FIRST,
  getCombinedEmotionStats,
  getEmotionHistoryStats,
  getEmotionTimelineRuns,
} from '@/lib/emotionHistory'

describe('emotion history', () => {
  it('builds the selected inclusive logical-day range', () => {
    const state = {
      ...createStartedHanaState('2026-07-01'),
      currentDate: '2026-08-10',
      dailyEmotions: {
        '2026-08-03': 'low' as const,
        '2026-08-04': 'good' as const,
        '2026-08-10': 'bright' as const,
      },
    }

    const stats = getEmotionHistoryStats(state, 7)
    expect(stats.startDate).toBe('2026-08-04')
    expect(stats.endDate).toBe('2026-08-10')
    expect(stats.days).toHaveLength(7)
    expect(stats.recordedDays).toBe(2)
    expect(stats.current).toBe('bright')
  })

  it('clamps history to the profile start day', () => {
    const state = {
      ...createStartedHanaState('2026-08-08'),
      currentDate: '2026-08-10',
    }

    const stats = getEmotionHistoryStats(state, 30)
    expect(stats.startDate).toBe('2026-08-08')
    expect(stats.days.map((day) => day.dateKey)).toEqual([
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
    ])
  })

  it('uses the most recent emotion to resolve an equal-frequency tie', () => {
    const state = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-04',
      dailyEmotions: {
        '2026-08-01': 'good' as const,
        '2026-08-02': 'okay' as const,
        '2026-08-03': 'good' as const,
        '2026-08-04': 'okay' as const,
      },
    }

    expect(getEmotionHistoryStats(state, 7).mostCommon).toBe('okay')
  })

  it('keeps blank dates as gaps between plotted runs', () => {
    const state = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-04',
      dailyEmotions: {
        '2026-08-01': 'good' as const,
        '2026-08-02': 'okay' as const,
        '2026-08-04': 'bright' as const,
      },
    }

    const runs = getEmotionTimelineRuns(getEmotionHistoryStats(state, 7).days)
    expect(runs.map((run) => run.map((day) => day.dateKey))).toEqual([
      ['2026-08-01', '2026-08-02'],
      ['2026-08-04'],
    ])
    expect(EMOTIONS_BEST_FIRST).toEqual([
      'bright',
      'good',
      'okay',
      'low',
      'heavy',
    ])
  })
})

describe('combined emotion history', () => {
  it('aligns both profiles to the earlier current logical day and later start', () => {
    const hana = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-10',
      dailyEmotions: {
        '2026-08-04': 'good' as const,
        '2026-08-06': 'bright' as const,
        '2026-08-09': 'low' as const,
      },
    }
    const cramble = {
      ...createStartedHanaState('2026-08-04'),
      currentDate: '2026-08-08',
      dailyEmotions: {
        '2026-08-05': 'heavy' as const,
        '2026-08-06': 'okay' as const,
      },
    }

    const stats = getCombinedEmotionStats(hana, cramble, 7)

    expect(stats).toEqual({
      range: 7,
      startDate: '2026-08-04',
      endDate: '2026-08-08',
      days: [
        {
          dateKey: '2026-08-04',
          hanaEmotion: 'good',
          crambleEmotion: null,
        },
        {
          dateKey: '2026-08-05',
          hanaEmotion: null,
          crambleEmotion: 'heavy',
        },
        {
          dateKey: '2026-08-06',
          hanaEmotion: 'bright',
          crambleEmotion: 'okay',
        },
        {
          dateKey: '2026-08-07',
          hanaEmotion: null,
          crambleEmotion: null,
        },
        {
          dateKey: '2026-08-08',
          hanaEmotion: null,
          crambleEmotion: null,
        },
      ],
    })
  })

  it('keeps the full 30-day logical range when neither start date clamps it', () => {
    const hana = {
      ...createStartedHanaState('2026-01-01'),
      currentDate: '2026-08-14',
    }
    const cramble = {
      ...createStartedHanaState('2026-02-01'),
      currentDate: '2026-08-14',
    }

    const stats = getCombinedEmotionStats(hana, cramble, 30)

    expect(stats.startDate).toBe('2026-07-16')
    expect(stats.endDate).toBe('2026-08-14')
    expect(stats.days).toHaveLength(30)
    expect(stats.days.every(
      ({ hanaEmotion, crambleEmotion }) =>
        hanaEmotion === null && crambleEmotion === null,
    )).toBe(true)
  })

  it('ignores a null start date while preserving the other profile boundary', () => {
    const hana = {
      ...createStartedHanaState('2026-08-12'),
      currentDate: '2026-08-14',
    }
    const cramble = {
      ...createStartedHanaState('2026-08-01'),
      startDate: null,
      currentDate: '2026-08-14',
    }

    const stats = getCombinedEmotionStats(hana, cramble, 7)

    expect(stats.startDate).toBe('2026-08-12')
    expect(stats.days.map(({ dateKey }) => dateKey)).toEqual([
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
    ])
  })
})
