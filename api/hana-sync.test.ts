import { beforeEach, describe, expect, it, vi } from 'vitest'

import { crambleQuests } from '../src/data/crambleQuests'
import { createProfileCloudSyncPayload } from '../src/lib/hanaCloudSync'
import { createStartedHanaState } from '../src/lib/hanaGame'

const database = vi.hoisted(() => ({
  transactionQueries: [] as string[],
}))

vi.mock('@neondatabase/serverless', () => {
  type FakeQuery = Promise<unknown[]> & { queryText: string }
  const sql = ((strings: TemplateStringsArray) => {
    const query = Promise.resolve([]) as unknown as FakeQuery
    query.queryText = strings.join('?')
    return query
  }) as {
    (strings: TemplateStringsArray, ...values: unknown[]): FakeQuery
    transaction(queries: FakeQuery[]): Promise<unknown[][]>
  }
  sql.transaction = vi.fn(async (queries: FakeQuery[]) => {
    database.transactionQueries = queries.map((query) => query.queryText)
    return queries.map((query) =>
      query.queryText.includes('UPDATE hana_state_snapshots')
        ? [{ revision: 3, synced_at: '2026-08-11T04:00:00.000Z' }]
        : [],
    )
  })
  return { neon: () => sql }
})

import handler from './hana-sync'

describe('profile sync API revision writes', () => {
  beforeEach(() => {
    database.transactionQueries = []
    process.env.DATABASE_URL = 'postgresql://example.invalid/neondb'
  })

  it('updates an established profile with a matching nonzero revision', async () => {
    const state = {
      ...createStartedHanaState('2026-08-11'),
      syncRevision: 2,
    }
    const payload = createProfileCloudSyncPayload(
      'cramble',
      state,
      crambleQuests,
      '2026-08-11T04:00:00.000Z',
      'sync-established-profile-test',
    )
    let statusCode = 200
    let responseBody: unknown
    const response = {
      setHeader() {},
      status(code: number) {
        statusCode = code
        return this
      },
      json(body: unknown) {
        responseBody = body
      },
      end() {},
    }

    await handler(
      { method: 'POST', body: { ...payload, baseRevision: 2 }, query: {} },
      response,
    )

    expect(statusCode).toBe(200)
    expect(responseBody).toMatchObject({ ok: true, revision: 3 })
    expect(database.transactionQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('UPDATE hana_state_snapshots'),
        expect.stringContaining('ON CONFLICT (profile_id) DO NOTHING'),
      ]),
    )
  })
})
