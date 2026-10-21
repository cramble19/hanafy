import { useEffect, useState } from 'react'
import { defaultPushSchedule, validPushSchedule, type PushSchedule } from '@/lib/pushSchedule'

const deviceKey = 'cramble-push-device-v1'
function deviceToken() {
  let token = localStorage.getItem(deviceKey)
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(deviceKey, token)
  }
  return token
}
async function request(body?: unknown, config = false) {
  const response = await fetch(`/api/cramble-push${config ? '?action=config' : ''}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken()}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Could not update notifications.')
  return data
}
export function NotificationSettings() {
  const [schedule, setSchedule] = useState<PushSchedule>(defaultPushSchedule)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const supported = /Android/i.test(navigator.userAgent) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  useEffect(() => {
    let active = true
    if (!supported) { setBusy(false); return }
    request().then(data => { if (active) { setEnabled(data.enabled === true); if (validPushSchedule(data.schedule)) setSchedule(data.schedule) } })
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [supported])
  async function save(turnOn: boolean) {
    setError(''); setNotice('')
    if (turnOn && !validPushSchedule(schedule)) { setError('Choose three different reminder hours.'); return }
    setBusy(true)
    try {
      if (!turnOn) {
        await request({ enabled: false })
        setEnabled(false); setNotice('Notifications are off on this phone.')
      } else {
        // Permission must be requested directly from this button gesture.
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Allow notifications in your Android browser settings, then try again.')
        const { publicKey } = await request(undefined, true)
        const registration = await Promise.race([navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Open the installed app and try again.')), 12_000))])
        const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
        const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
        await request({ enabled: true, subscription: subscription.toJSON(), schedule })
        setEnabled(true); setNotice('Notification times saved for this phone.')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save notifications.') }
    finally { setBusy(false) }
  }
  const hours = Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h % 12 || 12} {h < 12 ? 'AM' : 'PM'}</option>)
  return <section aria-label="Android notifications">
    <p className="someday-dialog-intro">India time. Notifications may arrive up to 59 minutes after the selected hour. Quiet while tracking is paused.</p>
    {!supported && <p role="status">Open Cramble on your Android phone to enable notifications.</p>}
    <label className="someday-field someday-category-field"><span>Morning quote</span><select aria-label="Morning quote" disabled={busy} value={schedule.quoteHour} onChange={e => setSchedule({ ...schedule, quoteHour: Number(e.target.value) })}>{hours}</select></label>
    <p className="sc-live-note">The same daily quote as Today.</p>
    {schedule.reminderHours.map((hour, index) => <label className="someday-field someday-category-field" key={index}><span>Record your day · {index + 1}</span><select aria-label={`Record your day · ${index + 1}`} disabled={busy} value={hour} onChange={e => setSchedule({ ...schedule, reminderHours: schedule.reminderHours.map((h, i) => i === index ? Number(e.target.value) : h) })}>{hours}</select></label>)}
    <p className="sc-live-note">Tapping a notification opens Today. If the quote and a reminder share an hour, they arrive together.</p>
    {error && <p role="alert" className="someday-dialog-error">{error}</p>}
    <p role="status" className="sc-live-note">{notice || (enabled ? 'Enabled on this phone' : 'Off on this phone')}</p>
    <div className="sc-category-actions"><button type="button" disabled={busy || !supported} onClick={() => void save(true)}>{busy ? 'Please wait…' : enabled ? 'Save times' : 'Enable on this phone'}</button>{enabled && <button type="button" disabled={busy} onClick={() => void save(false)}>Turn off</button>}</div>
  </section>
}
