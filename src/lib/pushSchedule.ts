import chronicles from '../data/crambleChronicles.json' with { type: 'json' }

export type PushSchedule = { quoteHour: number; reminderHours: number[] }
export const defaultPushSchedule: PushSchedule = { quoteHour: 8, reminderHours: [22, 0, 2] }
export function validPushSchedule(value: unknown): value is PushSchedule {
  const v = value as PushSchedule | null
  const hour = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 23
  return !!v && hour(v.quoteHour) && Array.isArray(v.reminderHours) && v.reminderHours.length === 3 &&
    v.reminderHours.every(hour) && new Set(v.reminderHours).size === 3
}
export function indiaClock(now: Date) {
  const local = new Date(now.getTime() + 330 * 60_000)
  const date = local.toISOString().slice(0, 10)
  const hour = local.getUTCHours()
  return { date, hour, minute: local.getUTCMinutes(), logicalDate: hour < 4
    ? new Date(local.getTime() - 86400_000).toISOString().slice(0, 10) : date }
}
export function getChronicleLine(date: string) {
  return chronicles[date.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) % chronicles.length]
}
export function profilePaused(state: unknown, date: string) {
  const pauses = (state as { trackingPauses?: { startDate: string; endDate: string | null }[] } | null)?.trackingPauses
  return Array.isArray(pauses) && pauses.some(p => p.startDate <= date && (!p.endDate || date <= p.endDate))
}
export function pushMessage(schedule: PushSchedule, now: Date) {
  const clock = indiaClock(now)
  const quote = schedule.quoteHour === clock.hour
  const reminder = schedule.reminderHours.includes(clock.hour)
  if (!quote && !reminder) return null
  return {
    title: quote ? 'Cramble · Quote of the day' : 'Cramble · Record your day',
    body: quote ? `${getChronicleLine(clock.logicalDate).text}${reminder ? '\nTake a moment to record your day.' : ''}`
      : 'Take a moment to record your habits and how you felt.',
    tag: `cramble-${clock.date}-${clock.hour}`,
    url: '/?notification=cramble',
    expiresAt: now.getTime() + (60 - clock.minute) * 60_000 - now.getUTCSeconds() * 1000,
  }
}
