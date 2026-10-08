import type { GameState, SomedayCategories } from '@/types'
import { DEFAULT_SOMEDAY_CATEGORIES, INITIAL_SOMEDAY_ASSIGNMENTS } from '@/data/somedayCategories'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function readSomedayCategories(value: unknown): SomedayCategories | undefined {
  if (!record(value) || value.version !== 1 || !record(value.categories) || !record(value.assignments)) return undefined
  const categories = Object.fromEntries(Object.entries(value.categories).filter(([id, name]) =>
    /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) && id !== 'unsorted' && typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 40,
  ).map(([id, name]) => [id, (name as string).trim()]))
  const assignments = Object.fromEntries(Object.entries(value.assignments).filter(([id]) => id.length > 0 && id.length <= 200)
    .map(([id, category]) => [id, typeof category === 'string' && Object.hasOwn(categories, category) ? category : null]))
  return { version: 1, categories, assignments }
}

/** Only seed approved IDs when metadata is absent. Never reassign a renamed or uncategorized item. */
export function getSomedayCategories(state: GameState): SomedayCategories {
  return state.somedayCategories ?? {
    version: 1,
    categories: { ...DEFAULT_SOMEDAY_CATEGORIES },
    assignments: Object.fromEntries((state.somedayItems ?? []).map(item => [item.id, INITIAL_SOMEDAY_ASSIGNMENTS[item.id] ?? null])),
  }
}

export type SomedayCategoryChange =
  | { type: 'create'; name: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string }

export function changeSomedayCategory(state: GameState, change: SomedayCategoryChange): { state: GameState; error: string | null } {
  const settings = getSomedayCategories(state)
  if (change.type !== 'create' && !Object.hasOwn(settings.categories, change.id)) return { state, error: 'This category no longer exists.' }
  const categories = { ...settings.categories }
  let assignments = settings.assignments
  if (change.type === 'delete') {
    delete categories[change.id]
    assignments = Object.fromEntries(Object.entries(assignments).map(([id, category]) => [id, category === change.id ? null : category]))
  } else {
    const name = change.name.trim()
    if (!name || name.length > 40) return { state, error: 'Use a category name between 1 and 40 characters.' }
    if (name.toLowerCase() === 'unsorted' || Object.entries(categories).some(([id, existing]) =>
      (change.type === 'create' || id !== change.id) && existing.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return { state, error: 'That category name is already in use.' }
    }
    if (change.type === 'create' && Object.keys(categories).length >= 60) return { state, error: 'You can have up to 60 categories.' }
    const id = change.type === 'rename' ? change.id : `category-${globalThis.crypto.randomUUID()}`
    categories[id] = name
  }
  return { state: { ...state, somedayCategories: { version: 1, categories, assignments } }, error: null }
}

/** Metadata-only: completion, age, title, order and all tracking records stay untouched. */
export function assignSomedayCategory(state: GameState, itemId: string, categoryId: string | null): { state: GameState; error: string | null } {
  const settings = getSomedayCategories(state)
  if (!(state.somedayItems ?? []).some(item => item.id === itemId)) return { state, error: 'This item no longer exists.' }
  if (categoryId !== null && !Object.hasOwn(settings.categories, categoryId)) return { state, error: 'This category no longer exists. Choose another category.' }
  return { state: { ...state, somedayCategories: { ...settings, assignments: { ...settings.assignments, [itemId]: categoryId } } }, error: null }
}
