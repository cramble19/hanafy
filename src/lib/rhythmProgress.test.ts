import { describe, expect, it } from 'vitest'
import { getRhythmProgress, smoothProgressPath } from './rhythmProgress'
import type { RhythmTracker } from './rhythmStats'

const tracker: RhythmTracker = { id: 'test', title: 'Gym', created: '2026-01-01', dates: ['2026-10-01', '2026-10-05', '2026-10-05', '2026-10-11', '2026-10-12'], cadence: 'Anytime', paused: false, observation: false, lastDate: '2026-10-11' }
describe('Rhythm progress', () => {
  it('counts unique days in the range and includes earlier records only in rolling frequency', () => {
    const before = JSON.stringify(tracker)
    const days = getRhythmProgress(tracker, '2026-10-11', 7)
    expect(days[0]).toEqual({ date: '2026-10-05', recorded: true, cumulative: 1, recent: 2 })
    expect(days.at(-1)).toEqual({ date: '2026-10-11', recorded: true, cumulative: 2, recent: 2 })
    expect(days[1].cumulative).toBe(1)
    expect(JSON.stringify(tracker)).toBe(before)
  })
  it('supports all windows and leap/month boundaries', () => {
    for (const range of [7, 30, 90] as const) expect(getRhythmProgress(tracker, '2026-10-11', range)).toHaveLength(range)
    const days = getRhythmProgress({ ...tracker, dates: [], created: '2024-01-01' }, '2024-03-01', 7)
    expect(days.at(-2)?.date).toBe('2024-02-29')
    expect(days.every(day => day.cumulative === 0 && day.recent === 0)).toBe(true)
  })
  it('excludes records before task creation and future records', () => {
    const days = getRhythmProgress({ ...tracker, created: '2026-10-06' }, '2026-10-11', 30)
    expect(days.at(-1)?.cumulative).toBe(1)
    expect(days.at(-1)?.recent).toBe(1)
  })
  it('uses smooth curves through observations with flat plateaus and no overshoot', () => {
    expect(smoothProgressPath([])).toBe('')
    const points = [{ x: 0, y: 0 }, { x: 3, y: 3 }, { x: 6, y: 3 }, { x: 9, y: 0 }]
    const path = smoothProgressPath(points)
    expect(path).toBe('M0,0 C1,1 2,3 3,3 C4,3 5,3 6,3 C7,3 8,1 9,0')
  })
})
