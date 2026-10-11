import { addDays } from '@/lib/hanaGame'
import type { RhythmTracker } from '@/lib/rhythmStats'

export type ProgressRange = 7 | 30 | 90
export type ProgressDay = { date: string; recorded: boolean; cumulative: number; recent: number }

/** Counts recorded dates, not reps or rating values. Never changes source records. */
export function getRhythmProgress(tracker: RhythmTracker, end: string, range: ProgressRange): ProgressDay[] {
  const recorded = new Set(tracker.dates.filter(date => date >= tracker.created && date <= end))
  let cumulative = 0
  return Array.from({ length: range }, (_, index) => {
    const date = addDays(end, index - range + 1)
    const active = recorded.has(date)
    if (active) cumulative++
    const recent = Array.from({ length: 7 }, (_, offset) => addDays(date, -offset))
      .filter(day => recorded.has(day)).length
    return { date, recorded: active, cumulative, recent }
  })
}

/** Monotone cubic interpolation: passes through every daily value without overshoot. */
export function smoothProgressPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x))
  const tangents = points.map((_, i) => {
    if (!i) return slopes[0] ?? 0
    if (i === points.length - 1) return slopes[i - 1]
    const a = slopes[i - 1], b = slopes[i]
    return a * b <= 0 ? 0 : 2 * a * b / (a + b)
  })
  return `M${points[0].x},${points[0].y}` + points.slice(1).map((p, i) => {
    const previous = points[i], dx = (p.x - previous.x) / 3
    return ` C${previous.x + dx},${previous.y + dx * tangents[i]} ${p.x - dx},${p.y - dx * tangents[i + 1]} ${p.x},${p.y}`
  }).join('')
}
