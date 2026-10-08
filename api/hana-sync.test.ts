import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { crambleQuests } from '../src/data/crambleQuests'
import { quests } from '../src/data/quests'
import { createProfileCloudSyncPayload } from '../src/lib/hanaCloudSync'
import { createStartedHanaState } from '../src/lib/hanaGame'

const database = vi.hoisted(() => ({
  directQueries: [] as string[],
  transactionQueries: [] as string[],
  acceptedWrite: 'update' as 'update' | 'insert' | 'none',
  storedSchemaVersion: null as number | null,
  currentRows: [] as Array<{ revision: number; write_token: string }>,
}))

vi.mock('@neondatabase/serverless', () => {
  type FakeQuery = Promise<unknown[]> & {
    queryText: string
    values: unknown[]
  }
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const queryText = strings.join('?')
    database.directQueries.push(queryText)
    const rows = queryText.includes('SELECT revision, write_token')
      ? database.currentRows
      : []
    const query = Promise.resolve(rows) as unknown as FakeQuery
    query.queryText = queryText
    query.values = values
    return query
  }) as {
    (strings: TemplateStringsArray, ...values: unknown[]): FakeQuery
    transaction(queries: FakeQuery[]): Promise<unknown[][]>
  }
  sql.transaction = vi.fn(async (queries: FakeQuery[]) => {
    database.transactionQueries = queries.map((query) => query.queryText)
    return queries.map((query) => {
      const isSnapshotUpdate = query.queryText.includes(
        'UPDATE hana_state_snapshots',
      )
      const incomingSchemaVersion = isSnapshotUpdate
        ? query.values.at(-1)
        : null
      const acceptsSchemaVersion =
        database.storedSchemaVersion === null ||
        (typeof incomingSchemaVersion === 'number' &&
          database.storedSchemaVersion <= incomingSchemaVersion)
      const acceptsWrite =
        (database.acceptedWrite === 'update' &&
          isSnapshotUpdate &&
          acceptsSchemaVersion) ||
        (database.acceptedWrite === 'insert' &&
          query.queryText.includes('INSERT INTO hana_state_snapshots'))
      return acceptsWrite
        ? [
            {
              revision: database.acceptedWrite === 'insert' ? 1 : 3,
              synced_at: '2026-08-11T04:00:00.000Z',
            },
          ]
        : []
    })
  })
  return { neon: () => sql }
})

import handler from './hana-sync'

describe('profile sync API revision writes', () => {
  beforeEach(() => {
    database.directQueries = []
    database.transactionQueries = []
    database.acceptedWrite = 'update'
    database.storedSchemaVersion = null
    database.currentRows = []
    process.env.DATABASE_URL = 'postgresql://example.invalid/neondb'
    delete process.env.HANAFY_API_UPSTREAM
  })

  afterEach(() => {
    delete process.env.HANAFY_API_UPSTREAM
    vi.unstubAllGlobals()
  })

  it('forwards only Cramble reads through the dedicated frontend', async () => {
    process.env.HANAFY_API_UPSTREAM = 'https://hanafy-green.vercel.app'
    const upstreamFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, snapshot: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', upstreamFetch)
    let statusCode = 200
    let responseBody: unknown
    const response = {
      setHeader() {},
      status(code: number) { statusCode = code; return this },
      json(body: unknown) { responseBody = body },
      end() {},
    }

    await handler({ method: 'GET', query: { profileId: 'cramble' } }, response)

    expect(statusCode).toBe(200)
    expect(responseBody).toEqual({ ok: true, snapshot: null })
    expect(upstreamFetch).toHaveBeenCalledOnce()
    expect(String(upstreamFetch.mock.calls[0][0])).toBe(
      'https://hanafy-green.vercel.app/api/hana-sync?profileId=cramble',
    )
    expect(database.directQueries).toHaveLength(0)

    await handler({ method: 'GET', query: { profileId: 'hana' } }, response)
    expect(statusCode).toBe(400)
    expect(upstreamFetch).toHaveBeenCalledOnce()
  })

  it('preserves the write token and revision when forwarding Cramble saves', async () => {
    process.env.HANAFY_API_UPSTREAM = 'https://hanafy-green.vercel.app'
    const state = {
      ...createStartedHanaState('2026-08-11'),
      syncRevision: 2,
    }
    const payload = createProfileCloudSyncPayload(
      'cramble', state, crambleQuests, '2026-08-11T04:00:00.000Z',
      'direct-frontend-write-test',
    )
    const upstreamFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, revision: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', upstreamFetch)
    let statusCode = 200
    const response = {
      setHeader() {},
      status(code: number) { statusCode = code; return this },
      json() {},
      end() {},
    }

    await handler(
      { method: 'POST', body: { ...payload, baseRevision: 2 } },
      response,
    )

    expect(statusCode).toBe(200)
    const requestInit = upstreamFetch.mock.calls[0][1]
    const forwarded = JSON.parse(String(requestInit?.body))
    expect(forwarded.profileId).toBe('cramble')
    expect(forwarded.baseRevision).toBe(2)
    expect(forwarded.writeToken).toBe('direct-frontend-write-test')
    expect(database.directQueries).toHaveLength(0)
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
    // Older cached clients may not know this additive metadata field. Their
    // unrelated saves must retain it; newer payloads override it atomically.
    expect(database.transactionQueries.find(query => query.includes('UPDATE hana_state_snapshots')))
      .toContain("jsonb_build_object('somedayCategories', state -> 'somedayCategories')")
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

  it('reads Cramble through independently stored domains without affecting Hana', async () => {
    const response = { setHeader() {}, status() { return this }, json() {}, end() {} }
    await handler({ method: 'GET', query: { profileId: 'cramble' } }, response)
    expect(database.directQueries).toHaveLength(1)
    expect(database.directQueries[0]).toContain('FROM cramble_composed_state')
    expect(database.directQueries[0]).not.toMatch(/CREATE|INSERT|UPDATE|DELETE/)
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

  it.each([[5, 6], [7, 8]])('rejects a schema-v%i client write after a schema-v%i snapshot exists', async (clientVersion, storedVersion) => {
    database.storedSchemaVersion = storedVersion
    database.currentRows = [
      { revision: 2, write_token: 'schema-v6-current-write' },
    ]
    const state = {
      ...createStartedHanaState('2026-08-11'),
      schemaVersion: clientVersion,
      syncRevision: 2,
    }
    const payload = createProfileCloudSyncPayload(
      'hana',
      state,
      quests,
      '2026-08-11T04:00:00.000Z',
      'schema-v5-stale-client-write',
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
      currentRevision: 2,
    })
    expect(
      database.transactionQueries.find((query) =>
        query.includes('UPDATE hana_state_snapshots'),
      ),
    ).toContain("jsonb_typeof(state -> 'schemaVersion')")
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
