import { createHash, timingSafeEqual } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import webpush from 'web-push'
import { indiaClock, profilePaused, pushMessage, validPushSchedule } from '../src/lib/pushSchedule.js'

type Request = { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined> }
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; json(body: unknown): void }
const origins = new Set(['https://hanafy-green.vercel.app', 'https://hanafy-cramble.vercel.app'])
const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function validSubscription(value: unknown): value is webpush.PushSubscription {
  const v = value as webpush.PushSubscription | null
  if (!v || typeof v.endpoint !== 'string' || v.endpoint.length > 2048 || !v.keys) return false
  try {
    const url = new URL(v.endpoint)
    // Android Chrome / Firefox endpoints only. No arbitrary outbound URLs.
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(url.hostname)) return false
    return typeof v.keys.auth === 'string' && /^[\w-]{22}$/.test(v.keys.auth) &&
      typeof v.keys.p256dh === 'string' && /^[\w-]{87}$/.test(v.keys.p256dh)
  } catch { return false }
}
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  const action = text(req.query?.action)
  // Cramble's deployment forwards to the existing database-owning deployment.
  if (process.env.HANAFY_API_UPSTREAM) {
    if (action === 'dispatch') return res.status(200).json({ skipped: true })
    const upstream = new URL(process.env.HANAFY_API_UPSTREAM)
    if (upstream.origin !== 'https://hanafy-green.vercel.app') return res.status(503).json({ error: 'Invalid notification upstream.' })
    const url = new URL('/api/cramble-push', upstream.origin)
    if (action) url.searchParams.set('action', action)
    try {
      const response = await fetch(url, { method: req.method, headers: { 'Content-Type': 'application/json',
        Authorization: text(req.headers.authorization), Origin: text(req.headers.origin) },
        body: req.method === 'POST' ? JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : undefined,
        signal: AbortSignal.timeout(15_000) })
      return res.status(response.status).json(await response.json())
    } catch { return res.status(503).json({ error: 'Notifications are temporarily unavailable.' }) }
  }
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!publicKey || !privateKey || !databaseUrl || !process.env.CRON_SECRET) return res.status(503).json({ error: 'Notifications are not configured yet.' })
  if (req.method === 'GET' && action === 'config') return res.status(200).json({ publicKey })
  const sql = neon(databaseUrl)
  try {
    if (req.method === 'GET' && action === 'dispatch') {
      const secret = `Bearer ${process.env.CRON_SECRET}`
      const authorization = text(req.headers.authorization)
      if (authorization.length !== secret.length || !timingSafeEqual(Buffer.from(authorization), Buffer.from(secret))) return res.status(401).json({ error: 'Unauthorized' })
      const now = new Date(), clock = indiaClock(now)
      // Each daily job owns one IST hour. Ignore stale jobs instead of catching up overnight.
      if (text(req.query?.hour) !== String(clock.hour)) return res.status(200).json({ skipped: 'Outside scheduled hour' })
      const snapshots = await sql`SELECT state FROM cramble_composed_state WHERE profile_id = 'cramble' LIMIT 1`
      if (!snapshots.length || profilePaused(snapshots[0].state, clock.logicalDate)) return res.status(200).json({ skipped: 'Paused or no profile' })
      const devices = await sql`SELECT id, subscription, schedule FROM cramble_push_devices WHERE enabled = true`
      webpush.setVapidDetails('https://hanafy-green.vercel.app', publicKey, privateKey)
      let sent = 0, failed = 0
      for (const device of devices) {
        if (!validPushSchedule(device.schedule) || !validSubscription(device.subscription)) continue
        const message = pushMessage(device.schedule, now)
        if (!message) continue
        // Atomic claim means retries/concurrent cron invocations cannot double-send.
        const claimed = await sql`UPDATE cramble_push_devices SET last_slot = ${message.tag}
          WHERE id = ${device.id} AND enabled = true AND last_slot IS DISTINCT FROM ${message.tag}
          AND schedule = ${JSON.stringify(device.schedule)}::jsonb RETURNING id`
        if (!claimed.length) continue
        try {
          await webpush.sendNotification(device.subscription, JSON.stringify(message), {
            TTL: Math.max(1, Math.floor((message.expiresAt - Date.now()) / 1000)), timeout: 8000,
          })
          sent++
        } catch (error) {
          failed++
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await sql`UPDATE cramble_push_devices SET enabled = false WHERE id = ${device.id}`
          // Keep the claim on ambiguous failures: prefer a missed reminder to duplicates.
        }
      }
      return res.status(200).json({ sent, failed })
    }
    const token = text(req.headers.authorization).replace(/^Bearer /, '')
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Invalid device token.' })
    const id = hash(token)
    if (req.method === 'GET') {
      const rows = await sql`SELECT schedule, enabled FROM cramble_push_devices WHERE id = ${id}`
      return res.status(200).json(rows[0] ?? { enabled: false })
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (!origins.has(text(req.headers.origin))) return res.status(403).json({ error: 'Invalid origin.' })
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | null
    if (body?.enabled === false) {
      await sql`UPDATE cramble_push_devices SET enabled = false, updated_at = now() WHERE id = ${id}`
      return res.status(200).json({ enabled: false })
    }
    if (body?.enabled !== true || !validSubscription(body.subscription) || !validPushSchedule(body.schedule)) return res.status(400).json({ error: 'Choose three different reminder hours and a valid morning hour.' })
    await sql`INSERT INTO cramble_push_devices (id, subscription, schedule) VALUES
      (${id}, ${JSON.stringify(body.subscription)}::jsonb, ${JSON.stringify(body.schedule)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET subscription = EXCLUDED.subscription, schedule = EXCLUDED.schedule, enabled = true, updated_at = now()`
    return res.status(200).json({ enabled: true })
  } catch {
    return res.status(503).json({ error: 'Could not save or send notifications. Please retry.' })
  }
}
