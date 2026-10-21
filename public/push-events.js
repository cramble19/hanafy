/* Loaded by Workbox; independent of offline caching and application state. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data
    try { data = event.data?.json() } catch { return }
    if (!data || typeof data.title !== 'string' || typeof data.body !== 'string') return
    if (!Number.isFinite(data.expiresAt) || Date.now() >= data.expiresAt) return
    await self.registration.showNotification(data.title, {
      body: data.body, tag: data.tag, icon: '/pwa-192x192.png',
      data: { url: '/?notification=cramble' },
    })
  })())
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const target = new URL('/?notification=cramble', self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.navigate(target); await existing.focus() }
    else await self.clients.openWindow(target)
  })())
})
