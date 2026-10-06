import type { GameState, RhythmSettings } from '@/types'

export const DEFAULT_RHYTHM_CATEGORIES: Record<string, string> = {
  movement: 'Movement', care: 'Care', connection: 'Connection', 'mind-play': 'Mind & Play',
}
const INITIAL_ASSIGNMENTS: Record<string, string> = {
  gym: 'movement', gymhana: 'movement', pushups: 'movement', badminton: 'movement',
  swimming: 'movement', tabletennis: 'movement', shampoo: 'care', conditioner: 'care',
  brushtwice: 'care', journal: 'mind-play', chess: 'mind-play', playhalimba: 'mind-play',
  chinese: 'mind-play',
}
export const CATEGORY_NAME_LIMIT = 40
export const CATEGORY_LIMIT = 60
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function readRhythmSettings(value: unknown): RhythmSettings | undefined {
  if (!record(value) || value.version !== 1 || !record(value.categories) || !record(value.assignments)) return undefined
  const categories = Object.fromEntries(Object.entries(value.categories).filter(([id, name]) =>
    /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) && id !== 'unsorted' &&
    typeof name === 'string' && name.trim().length > 0 && name.trim().length <= CATEGORY_NAME_LIMIT,
  ).map(([id, name]) => [id, (name as string).trim()]))
  const assignments = Object.fromEntries(Object.entries(value.assignments).filter(([id]) =>
    id.length > 0 && id.length <= 200,
  ).map(([id, category]) => [id, typeof category === 'string' && Object.hasOwn(categories, category) ? category : null]))
  return { version: 1, categories, assignments }
}

/** Titles are matched only for this initial seed; every later operation uses stable IDs. */
export function getRhythmSettings(state: GameState, trackers: Array<{ id: string; title: string }>): RhythmSettings {
  if (state.rhythm) return state.rhythm
  return {
    version: 1, categories: { ...DEFAULT_RHYTHM_CATEGORIES },
    assignments: Object.fromEntries(trackers.map(item => [item.id,
      INITIAL_ASSIGNMENTS[item.title.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? null,
    ])),
  }
}

export function createRhythmCategory(state: GameState, rawName: string, id = `area-${crypto.randomUUID()}`) {
  const name = rawName.trim().replace(/\s+/g, ' ')
  const rhythm = state.rhythm
  if (!rhythm) return { state, error: 'Open Rhythm before creating a category.', id: null }
  if (!name || name.length > CATEGORY_NAME_LIMIT) return { state, error: 'Use a category name between 1 and 40 characters.', id: null }
  if (['Unsorted', ...Object.values(rhythm.categories)].some(value => value.toLowerCase() === name.toLowerCase())) {
    return { state, error: 'That category already exists.', id: null }
  }
  if (Object.keys(rhythm.categories).length >= CATEGORY_LIMIT) return { state, error: 'You can create up to 60 categories.', id: null }
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) || id === 'unsorted' || Object.hasOwn(rhythm.categories, id)) return { state, error: 'Please try creating this category again.', id: null }
  return { state: { ...state, rhythm: { ...rhythm, categories: { ...rhythm.categories, [id]: name } } }, error: null, id }
}

export function assignRhythmCategory(state: GameState, habitId: string, category: string | null) {
  if (!state.rhythm || category !== null && !Object.hasOwn(state.rhythm.categories, category)) {
    return { state, error: 'That category is unavailable. Choose another category.' }
  }
  return {
    state: { ...state, rhythm: { ...state.rhythm, assignments: { ...state.rhythm.assignments, [habitId]: category } } },
    error: null,
  }
}
