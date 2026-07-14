import { describe, expect, it, vi } from 'vitest'
import type { HanaGameState } from '@/types'
import {
  clearHanaStateFromDb,
  chooseDbFirstState,
  loadHanaStateFromDb,
  saveHanaStateToDb,
} from './hanaRemoteState'

describe('Hana remote state helpers', () => {
  it('prefers database state over cache and initial state', () => {
    const databaseState = createState({ currentDate: '2026-07-14', totalFlowers: 7 })
    const cachedState = createState({ currentDate: '2026-07-13', totalFlowers: 2 })
    const initialState = createState({ currentDate: '2026-07-12', totalFlowers: 0 })

    const result = chooseDbFirstState({
      databaseState,
      cachedState,
      initialState,
    })

    expect(result.source).toBe('database')
    expect(result.state.totalFlowers).toBe(7)
  })

  it('falls back to cache when database state is empty', () => {
    const cachedState = createState({ currentDate: '2026-07-13', totalFlowers: 2 })
    const initialState = createState({ currentDate: '2026-07-12', totalFlowers: 0 })

    const result = chooseDbFirstState({
      databaseState: null,
      cachedState,
      initialState,
    })

    expect(result.source).toBe('cache')
    expect(result.state.totalFlowers).toBe(2)
  })

  it('loads a valid DB snapshot response', async () => {
    const state = createState({ currentDate: '2026-07-14', totalFlowers: 3 })
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          snapshot: {
            profileId: 'hana',
            currentDate: '2026-07-14',
            totalFlowers: 3,
            state,
            syncedAt: '2026-07-14T09:00:00.000Z',
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    const result = await loadHanaStateFromDb('hana', fetchImpl)

    expect(result).toEqual({
      ok: true,
      snapshot: {
        profileId: 'hana',
        currentDate: '2026-07-14',
        totalFlowers: 3,
        state,
        syncedAt: '2026-07-14T09:00:00.000Z',
      },
    })
    expect(fetchImpl).toHaveBeenCalledWith('/api/hana-sync?profileId=hana')
  })

  it('saves state to the DB endpoint', async () => {
    const state = createState({ currentDate: '2026-07-14', totalFlowers: 3 })
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as unknown as typeof fetch

    const result = await saveHanaStateToDb(state, 'hana', fetchImpl)

    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/hana-sync',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )
  })

  it('does not save before Hana has started the health overhaul', async () => {
    const state = createState({ startDate: null })
    const fetchImpl = vi.fn() as unknown as typeof fetch

    const result = await saveHanaStateToDb(state, 'hana', fetchImpl)

    expect(result).toEqual({
      ok: false,
      error: 'Cannot save Hana before health overhaul is started',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('clears Hana state from the DB endpoint', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as unknown as typeof fetch

    const result = await clearHanaStateFromDb('hana', fetchImpl)

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledWith('/api/hana-sync?profileId=hana', {
      method: 'DELETE',
    })
  })
})

function createState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    startDate: '2026-07-14',
    currentDate: '2026-07-14',
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
    ...overrides,
  }
}
