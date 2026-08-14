import { beforeEach, describe, expect, it, vi } from 'vitest'

import { crambleQuests } from '../src/data/crambleQuests'
import { quests } from '../src/data/quests'
import { createProfileCloudSyncPayload } from '../src/lib/hanaCloudSync'
import { createStartedHanaState } from '../src/lib/hanaGame'

const database = vi.hoisted(() => ({
  directQueries: [] as string[],
  transactionQueries: [] as string[],
  acceptedWrite: 'update' as 'update' | 'insert' | 'none',
  currentRows: [] as Array<{ revision: number; write_token: string }>,
}))

vi.mock('@neondatabase/serverless', () => {
  type FakeQuery = Promise<unknown[]> & { queryText: string }
  const sql = ((strings: TemplateStringsArray) => {
    const queryText = strings.join('?')
    database.directQueries.push(queryText)
    const rows = queryText.includes('SELECT revision, write_token')
      ? database.currentRows
      : []
    const query = Promise.resolve(rows) as unknown as FakeQuery
    query.queryText = queryText
    return query
  }) as {
    (strings: TemplateStringsArray, ...values: unknown[]): FakeQuery
    transaction(queries: FakeQuery[]): Promise<unknown[][]>
  }
  sql.transaction = vi.fn(async (queries: FakeQuery[]) => {
    database.transactionQueries = queries.map((query) => query.queryText)
    return queries.map((query) =>
      (database.acceptedWrite === 'update' &&
        query.queryText.includes('UPDATE hana_state_snapshots')) ||
      (database.acceptedWrite === 'insert' &&
        query.queryText.includes('INSERT INTO hana_state_snapshots'))
        ? [
            {
              revision: database.acceptedWrite === 'insert' ? 1 : 3,
              synced_at: '2026-08-11T04:00:00.000Z',
            },
          ]
        : [],
    )
  })
  return { neon: () => sql }
})

import handler from './hana-sync'

describe('profile sync API revision writes', () => {
  beforeEach(() => {
    database.directQueries = []
    database.transactionQueries = []
    database.acceptedWrite = 'update'
    database.currentRows = []
    process.env.DATABASE_URL = 'postgresql://example.invalid/neondb'
  })

  it('reads a profile without running schema DDL in the request path', async () => {
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
      { method: 'GET', query: { profileId: 'hana' } },
      response,
    )

    expect(statusCode).toBe(200)
    expect(responseBody).toEqual({ ok: true, snapshot: null })
    expect(database.directQueries).toHaveLength(1)
    expect(database.directQueries[0]).toContain('FROM hana_state_snapshots')
    expect(database.directQueries[0]).not.toMatch(/CREATE TABLE|ALTER TABLE/)
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
    expect(
      [...database.directQueries, ...database.transactionQueries].join('\n'),
    ).not.toMatch(/CREATE TABLE|ALTER TABLE|DO \$\$/)
  })

  it('creates Hana on her first save at revision zero', async () => {
    database.acceptedWrite = 'insert'
    const state = createStartedHanaState('2026-08-11')
    const payload = createProfileCloudSyncPayload(
      'hana',
      state,
      quests,
      '2026-08-11T04:00:00.000Z',
      'sync-hana-first-save-test',
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
      { method: 'POST', body: { ...payload, baseRevision: 0 }, query: {} },
      response,
    )

    expect(statusCode).toBe(200)
    expect(responseBody).toMatchObject({ ok: true, revision: 1 })
  })

  it('accepts an identical retry without creating another revision', async () => {
    database.acceptedWrite = 'none'
    database.currentRows = [
      { revision: 3, write_token: 'sync-idempotent-retry-test' },
    ]
    const state = {
      ...createStartedHanaState('2026-08-11'),
      syncRevision: 2,
    }
    const payload = createProfileCloudSyncPayload(
      'hana',
      state,
      quests,
      '2026-08-11T04:00:00.000Z',
      'sync-idempotent-retry-test',
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
    expect(responseBody).toMatchObject({
      ok: true,
      revision: 3,
      idempotent: true,
    })
  })

  it('reports the current revision for a genuinely stale write', async () => {
    database.acceptedWrite = 'none'
    database.currentRows = [
      { revision: 3, write_token: 'different-device-write' },
    ]
    const state = {
      ...createStartedHanaState('2026-08-11'),
      syncRevision: 2,
    }
    const payload = createProfileCloudSyncPayload(
      'hana',
      state,
      quests,
      '2026-08-11T04:00:00.000Z',
      'sync-stale-write-test',
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

    expect(statusCode).toBe(409)
    expect(responseBody).toMatchObject({
      error: 'The profile changed on another device',
      currentRevision: 3,
    })
  })
})
