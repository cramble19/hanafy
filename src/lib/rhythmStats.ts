import type { GameState, Quest } from '@/types'
import { addDays } from '@/lib/hanaGame'
import { isHabitArchivedOnDate, isHabitGraduatedOnDate, isHabitPausedOnDate } from '@/lib/habitLifecycle'
import { getOpenActivityCatalog } from '@/lib/openActivities'

export type RhythmRange = 7 | 30
export type RhythmTracker = {
  id: string; title: string; created: string; dates: string[]; lastDate: string | null
  cadence: string; paused: boolean; observation: boolean
}

/** Actual dated records, never completion percentages or sums of reps/ratings. */
export function getRhythmTrackers(state: GameState, _quests: Quest[]): RhythmTracker[] {
  const current = (id: string) => !state.deletedHabitIds?.includes(id) &&
    !isHabitArchivedOnDate(state, id) && !isHabitGraduatedOnDate(state, id)
  const open: RhythmTracker[] = getOpenActivityCatalog(state)
    .filter(item => current(item.id) && item.createdDate <= state.currentDate)
    .map(item => {
      const created = [item.createdDate, state.startDate ?? ''].sort().at(-1)!
      const dates = Object.entries(state.openActivityLogs).filter(([date, values]) =>
        date >= created && date <= state.currentDate && Number.isFinite(values[item.id]) && values[item.id] > 0,
      ).map(([date]) => date).sort()
      return { id: item.id, title: item.title, created, dates, lastDate: dates.at(-1) ?? null,
        cadence: 'Anytime', paused: isHabitPausedOnDate(state, item.id), observation: item.kind === 'rating' }
    })
  // Scheduled quests belong to Observatory, not the habit-frequency page.
  return open
}

export function getRhythmDates(end: string, range: RhythmRange) {
  return Array.from({ length: range }, (_, i) => addDays(end, i - range + 1))
}
export function recordedDays(tracker: RhythmTracker, dates: string[]) {
  const allowed = new Set(dates)
  return tracker.dates.filter(date => allowed.has(date))
}
export function sortRhythmTrackers(trackers: RhythmTracker[], dates: string[]) {
  const counts = new Map(trackers.map(item => [item.id, recordedDays(item, dates).length]))
  return [...trackers].sort((a, b) => counts.get(b.id)! - counts.get(a.id)! ||
    (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}
export function categoryRecordedDays(trackers: RhythmTracker[], dates: string[]) {
  return [...new Set(trackers.flatMap(item => recordedDays(item, dates)))].sort()
}
