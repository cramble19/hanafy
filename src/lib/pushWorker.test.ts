import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const events: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn(), openWindow = vi.fn(), navigate = vi.fn(), focus = vi.fn()
  const client = { url: 'https://hanafy-cramble.vercel.app/', navigate, focus }
  runInNewContext(readFileSync('public/push-events.js', 'utf8'), { URL, Date, self: {
    addEventListener: (name: string, callback: (event: unknown) => void) => { events[name] = callback },
    registration: { showNotification }, location: { origin: 'https://hanafy-cramble.vercel.app' },
    clients: { matchAll: async () => [client], openWindow },
  } })
  return { events, showNotification, navigate, focus }
}
describe('push service worker', () => {
  it('displays timely messages, but discards expired or malformed messages', async () => {
    const w = worker(); let completion: Promise<void> = Promise.resolve()
    const deliver = async (data: unknown) => { w.events.push({ data: { json: () => data }, waitUntil: (p: Promise<void>) => { completion = p } }); await completion }
    await deliver({ title: 'Quote', body: 'Hello', tag: 'unique', expiresAt: Date.now() + 60_000 })
    expect(w.showNotification).toHaveBeenCalledTimes(1)
    await deliver({ title: 'Late', body: 'Hello', expiresAt: Date.now() - 1 })
    await deliver({ title: 'Invalid' })
    expect(w.showNotification).toHaveBeenCalledTimes(1)
  })
  it('opens Today in an existing app window and ignores payload URLs', async () => {
    const w = worker(); let completion: Promise<void> = Promise.resolve()
    w.events.notificationclick({ notification: { close: vi.fn(), data: { url: 'https://evil.example' } }, waitUntil: (p: Promise<void>) => { completion = p } })
    await completion
    expect(w.navigate).toHaveBeenCalledWith('https://hanafy-cramble.vercel.app/?notification=cramble')
    expect(w.focus).toHaveBeenCalledOnce()
  })
})
