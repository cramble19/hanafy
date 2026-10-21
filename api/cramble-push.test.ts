import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rows: [] as unknown[][], queries: [] as string[], send: vi.fn() }))
vi.mock('@neondatabase/serverless', () => ({ neon: () => (strings: TemplateStringsArray) => { mocks.queries.push(strings.join('?')); return Promise.resolve(mocks.rows.shift() ?? []) } }))
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: mocks.send } }))
import handler, { validSubscription } from './cramble-push'
import { defaultPushSchedule } from '../src/lib/pushSchedule'
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: { auth: 'a'.repeat(22), p256dh: 'b'.repeat(87) } }
async function call(options: Partial<Parameters<typeof handler>[0]> = {}) {
  let code = 200, body: unknown
  const res = { setHeader: vi.fn(), status(n: number) { code = n; return res }, json(data: unknown) { body = data } }
  await handler({ method: 'GET', headers: {}, ...options }, res)
  return { code, body }
}
beforeEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs(); mocks.rows = []; mocks.queries = []; mocks.send.mockReset()
  for (const name of ['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'DATABASE_URL', 'CRON_SECRET']) vi.stubEnv(name, 'test')
  vi.stubEnv('HANAFY_API_UPSTREAM', '')
})
describe('notification endpoint safety', () => {
  it('rejects arbitrary outbound subscription endpoints', () => {
    expect(validSubscription(subscription)).toBe(true)
    for (const endpoint of ['http://fcm.googleapis.com/test', 'https://localhost/test', 'https://fcm.googleapis.com.evil.com/test', 'https://fcm.googleapis.com:4430/test', 'https://user@fcm.googleapis.com/test']) expect(validSubscription({ ...subscription, endpoint })).toBe(false)
  })
  it('requires scheduler authorization and device tokens', async () => {
    expect((await call({ query: { action: 'dispatch', hour: '8' } })).code).toBe(401)
    expect((await call()).code).toBe(401)
    expect(mocks.queries).toHaveLength(0)
  })
  it('rejects cross-site writes and duplicate times', async () => {
    expect((await call({ method: 'POST', headers: { authorization: `Bearer ${'a'.repeat(64)}`, origin: 'https://evil.com' } })).code).toBe(403)
    expect((await call({ method: 'POST', headers: { authorization: `Bearer ${'a'.repeat(64)}`, origin: 'https://hanafy-cramble.vercel.app' }, body: { enabled: true, subscription, schedule: { quoteHour: 8, reminderHours: [2, 2, 22] } } })).code).toBe(400)
    expect(mocks.queries).toHaveLength(0)
  })
  it('never updates tracking snapshots when saving preferences', async () => {
    expect((await call({ method: 'POST', headers: { authorization: `Bearer ${'a'.repeat(64)}`, origin: 'https://hanafy-cramble.vercel.app' }, body: { enabled: true, subscription, schedule: defaultPushSchedule } })).code).toBe(200)
    expect(mocks.queries).toHaveLength(1)
    expect(mocks.queries[0]).toContain('INSERT INTO cramble_push_devices')
  })
  it('skips late jobs and paused profiles', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T02:40:00Z'))
    const req = { query: { action: 'dispatch', hour: '7' }, headers: { authorization: 'Bearer test' } }
    await call(req); expect(mocks.queries).toHaveLength(0)
    mocks.rows = [[{ state: { trackingPauses: [{ startDate: '2026-10-22', endDate: null }] } }]]
    await call({ ...req, query: { action: 'dispatch', hour: '8' } })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('claims a slot before sending and suppresses duplicate invocations', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T02:40:00Z'))
    const req = { query: { action: 'dispatch', hour: '8' }, headers: { authorization: 'Bearer test' } }
    const device = { id: 'device', subscription, schedule: defaultPushSchedule }
    mocks.rows = [[{ state: {} }], [device], [{ id: 'device' }]]
    await call(req); expect(mocks.send).toHaveBeenCalledTimes(1)
    mocks.rows = [[{ state: {} }], [device], []]
    await call(req); expect(mocks.send).toHaveBeenCalledTimes(1)
  })
})
