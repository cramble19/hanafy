import type {
  GameState,
  NewSomedayItemInput,
  SomedayItem,
} from '@/types'

export const SOMEDAY_LIMITS = {
  items: 250,
  title: 100,
  minimumAge: 1,
  maximumAge: 120,
} as const

export function getNewSomedayItemValidationError(
  input: NewSomedayItemInput,
  existingItems: SomedayItem[] = [],
) {
  const title = input.title.trim()
  if (!title) return 'Add the thing you want to do.'
  if (title.length > SOMEDAY_LIMITS.title) {
    return `Keep it under ${SOMEDAY_LIMITS.title} characters.`
  }
  if (
    existingItems.some(
      (item) => item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
  ) {
    return 'That is already in Someday.'
  }
  if (input.timing === 'beforeAge') {
    const age = input.targetAge
    if (
      !Number.isInteger(age) ||
      (age as number) < SOMEDAY_LIMITS.minimumAge ||
      (age as number) > SOMEDAY_LIMITS.maximumAge
    ) {
      return `Choose a whole age from ${SOMEDAY_LIMITS.minimumAge} to ${SOMEDAY_LIMITS.maximumAge}.`
    }
  }
  return null
}

export function createSomedayItem(
  input: NewSomedayItemInput,
  createdDate: string,
): SomedayItem {
  return {
    id: createEventId('someday'),
    title: input.title.trim().slice(0, SOMEDAY_LIMITS.title),
    timing: input.timing,
    targetAge:
      input.timing === 'beforeAge' && Number.isInteger(input.targetAge)
        ? input.targetAge as number
        : null,
    createdDate,
    completedDate: null,
  }
}

export function addSomedayItem(
  state: GameState,
  input: NewSomedayItemInput,
): { state: GameState; error: string | null } {
  const items = state.somedayItems ?? []
  if (items.length >= SOMEDAY_LIMITS.items) {
    return { state, error: 'Someday is full for now.' }
  }
  const error = getNewSomedayItemValidationError(input, items)
  if (error) return { state, error }
  return {
    state: {
      ...state,
      somedayItems: [...items, createSomedayItem(input, state.currentDate)],
    },
    error: null,
  }
}

export function toggleSomedayItem(
  state: GameState,
  itemId: string,
): GameState {
  const items = state.somedayItems ?? []
  const item = items.find((candidate) => candidate.id === itemId)
  if (!item) return state
  return {
    ...state,
    somedayItems: items.map((candidate) =>
      candidate.id === itemId
        ? {
            ...candidate,
            completedDate: candidate.completedDate ? null : state.currentDate,
          }
        : candidate,
    ),
  }
}

export function updateSomedayItem(
  state: GameState,
  itemId: string,
  input: NewSomedayItemInput,
): { state: GameState; error: string | null } {
  const items = state.somedayItems ?? []
  const item = items.find((candidate) => candidate.id === itemId)
  if (!item) return { state, error: 'That Someday item no longer exists.' }

  const error = getNewSomedayItemValidationError(
    input,
    items.filter((candidate) => candidate.id !== itemId),
  )
  if (error) return { state, error }

  const title = input.title.trim().slice(0, SOMEDAY_LIMITS.title)
  const targetAge = input.timing === 'beforeAge' && Number.isInteger(input.targetAge)
    ? input.targetAge as number
    : null
  if (
    item.title === title &&
    item.timing === input.timing &&
    item.targetAge === targetAge
  ) {
    return { state, error: null }
  }

  return {
    state: {
      ...state,
      somedayItems: items.map((candidate) =>
        candidate.id === itemId
          ? { ...candidate, title, timing: input.timing, targetAge }
          : candidate,
      ),
    },
    error: null,
  }
}

export function deleteSomedayItem(
  state: GameState,
  itemId: string,
): GameState {
  const items = state.somedayItems ?? []
  if (!items.some((candidate) => candidate.id === itemId)) return state
  return {
    ...state,
    somedayItems: items.filter((candidate) => candidate.id !== itemId),
  }
}

function createEventId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${randomId}`
}
