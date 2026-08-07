import { describe, expect, it, vi } from 'vitest'
import type { HanaGameState } from '@/types'
import {
  chooseDbFirstState,
  loadHanaStateFromDb,
  saveHanaStateToDb,
  saveProfileStateToDb,
} from './hanaRemoteState'
import { crambleQuests } from '@/data/crambleQuests'

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

  it('rejects a snapshot belonging to the other profile', async () => {
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

    await expect(loadHanaStateFromDb('cramble', fetchImpl)).resolves.toEqual({
      ok: false,
      error: 'Invalid DB snapshot response',
    })
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

  it('saves Cramble with the separate profile and quest catalog', async () => {
    const state = createState({
      currentDate: '2026-08-06',
      activeDailyQuests: {
        '2026-08-06': [
          'first-draught',
          'training-yard',
          'provisioners-plate',
          'evening-seal',
        ],
      },
    })
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    const result = await saveProfileStateToDb(
      state,
      'cramble',
      crambleQuests,
      fetchMock as unknown as typeof fetch,
    )

    expect(result.ok).toBe(true)
    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as {
      profileId: string
      questStatuses: Array<{ profileId: string; questId: string }>
    }
    expect(body.profileId).toBe('cramble')
    expect(body.questStatuses.every((row) => row.profileId === 'cramble')).toBe(
      true,
    )
    expect(body.questStatuses.map((row) => row.questId)).toEqual([
      'evening-seal',
      'first-draught',
      'provisioners-plate',
      'training-yard',
    ])
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

  it('couples a save to the revision captured with the local snapshot', async () => {
    const state = createState({ syncRevision: 7 })
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, revision: 8 }), { status: 200 }),
    ) as unknown as typeof fetch

    const result = await saveHanaStateToDb(state, 'hana', fetchImpl)
    const request = vi.mocked(fetchImpl).mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as {
      baseRevision: number
      writeToken: string
    }

    expect(result).toEqual(
      expect.objectContaining({ ok: true, revision: 8 }),
    )
    expect(body.baseRevision).toBe(7)
    expect(body.writeToken).toMatch(/^sync-/)
  })

  it('reports a revision conflict without rebasing the stale snapshot', async () => {
    const state = createState({ syncRevision: 3 })
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'conflict' }), { status: 409 }),
    ) as unknown as typeof fetch

    await expect(saveHanaStateToDb(state, 'hana', fetchImpl)).resolves.toEqual(
      expect.objectContaining({ ok: false, conflict: true }),
    )
  })
})

function createState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    startDate: '2026-07-14',
    currentDate: '2026-07-14',
    customHabits: [],
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    habitOccurrences: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
    ...overrides,
  }
}
