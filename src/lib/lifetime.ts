import type { GameState, LifetimeCounter } from '@/types'

export const lifetimeTotal = (counter: LifetimeCounter) => counter.startingTotal + counter.entries.reduce((sum, entry) => sum + entry.amount, 0)
const validNumber = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export type LifetimeChange =
  | { type: 'save'; id?: string; title: string; description: string; startingTotal: number; startingDescription?: string }
  | { type: 'record'; id: string; date: string; entryId?: string; note?: string }
  | { type: 'undo'; id: string; entryId: string }

export function changeLifetime(state: GameState, change: LifetimeChange): { state: GameState; error: string | null } {
  const counters = state.lifetimeCounters ?? []
  const counter = counters.find(item => item.id === change.id)
  const fail = (error: string) => ({ state, error })
  let updated: LifetimeCounter
  if (change.type === 'save') {
    const title = change.title.trim(), description = change.description.trim()
    const startingDescription = (change.startingDescription ?? counter?.startingDescription ?? '').trim()
    if (startingDescription.length > 2000) return fail('Keep the starting-total description under 2,000 characters.')
    if (!title || title.length > 100) return fail('Use a name between 1 and 100 characters.')
    if (description.length > 2000) return fail('Keep the description under 2,000 characters.')
    if (!validNumber(change.startingTotal)) return fail('Starting total must be a whole number from 0 to 1,000,000,000.')
    if (change.id && !counter) return fail('This counter is no longer available.')
    if (!counter && counters.length >= 200) return fail('You can create up to 200 counters.')
    updated = { ...(counter ?? { id: crypto.randomUUID(), createdDate: state.currentDate, entries: [] }), title, description, startingTotal: change.startingTotal, startingDescription }
  } else {
    if (!counter) return fail('This counter is no longer available.')
    if (change.type === 'record') {
      const note = (change.note ?? '').trim()
      if (note.length > 2000) return fail('Keep the event note under 2,000 characters.')
      if (!validDate(change.date) || change.date > state.currentDate) return fail('Choose a valid date no later than today.')
      if (change.entryId && counter.entries.some(entry => entry.id === change.entryId)) return { state, error: null }
      updated = { ...counter, entries: [...counter.entries, { id: change.entryId ?? crypto.randomUUID(), date: change.date, amount: 1, note }] }
    } else {
      updated = { ...counter, entries: counter.entries.filter(entry => entry.id !== change.entryId) }
    }
  }
  if (!validNumber(lifetimeTotal(updated))) return fail('The total is too large.')
  return { state: { ...state, lifetimeCounters: counter ? counters.map(item => item.id === counter.id ? updated : item) : [...counters, updated] }, error: null }
}

export function readLifetimeCounters(value: unknown): LifetimeCounter[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is LifetimeCounter => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && validNumber(item.startingTotal) && typeof item.createdDate === 'string' && validDate(item.createdDate) && Array.isArray(item.entries) && item.entries.every((entry: { id?: unknown; date?: unknown; amount?: unknown }) => typeof entry.id === 'string' && typeof entry.date === 'string' && validDate(entry.date) && typeof entry.amount === 'number' && validNumber(entry.amount)) && validNumber(lifetimeTotal(item)))
}
