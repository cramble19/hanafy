import type { GameState, OpenActivity, RhythmSettings } from '@/types'
import { getRhythmDates } from './rhythmStats'

export type TodayOrder = NonNullable<RhythmSettings['today']>
export const defaultTodayOrder: TodayOrder = { sort: 'manual', groupOrder: [], habitOrder: [] }
export function orderedIds(ids: string[], saved: string[]) {
  return [...new Set([...saved.filter(id => ids.includes(id)), ...ids])]
}
export function todaySections(activities: OpenActivity[], settings: RhythmSettings, logs: GameState['openActivityLogs'], date: string) {
  const order = settings.today ?? defaultTodayOrder
  const ids = orderedIds(activities.map(item => item.id), order.habitOrder)
  const sorted = [...activities].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  if (order.sort === '7' || order.sort === '30') {
    const dates = getRhythmDates(date, order.sort === '7' ? 7 : 30)
    const count = (id: string) => dates.filter(day => Number.isFinite(logs[day]?.[id]) && logs[day][id] > 0).length
    sorted.sort((a, b) => count(b.id) - count(a.id))
  }
  if (order.sort !== 'groups') return [{ id: 'all', title: '', activities: sorted }]
  return [...orderedIds(Object.keys(settings.categories), order.groupOrder), 'unsorted'].map(id => ({
    id, title: settings.categories[id] ?? 'Unsorted',
    activities: sorted.filter(item => (settings.assignments[item.id] && Object.hasOwn(settings.categories, settings.assignments[item.id]!) ? settings.assignments[item.id] : 'unsorted') === id),
  })).filter(section => section.activities.length)
}
