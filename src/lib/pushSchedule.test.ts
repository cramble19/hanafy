import { describe, expect, it } from 'vitest'
import { defaultPushSchedule, getChronicleLine, indiaClock, profilePaused, pushMessage, validPushSchedule } from './pushSchedule'
import config from '../../vercel.json'

describe('Android notification schedule', () => {
  it('accepts any whole hours and rejects duplicates/invalid input', () => {
    expect(validPushSchedule(defaultPushSchedule)).toBe(true)
    for (const value of [null, {}, { quoteHour: 24, reminderHours: [0, 1, 2] }, { quoteHour: 8, reminderHours: [0, 0, 2] }, { quoteHour: 8, reminderHours: [0, 1.5, 2] }]) expect(validPushSchedule(value)).toBe(false)
    expect(validPushSchedule({ quoteHour: 22, reminderHours: [22, 4, 12] })).toBe(true)
  })
  it('uses IST and the 4 AM logical day across midnight/month/year boundaries', () => {
    expect(indiaClock(new Date('2026-12-31T18:30:00Z'))).toMatchObject({ date: '2027-01-01', hour: 0, logicalDate: '2026-12-31' })
    expect(indiaClock(new Date('2027-01-01T22:30:00Z'))).toMatchObject({ hour: 4, logicalDate: '2027-01-02' })
  })
  it('shares the quote with Today and expires each notification at the hour boundary', () => {
    const message = pushMessage(defaultPushSchedule, new Date('2026-10-22T03:29:00Z'))!
    expect(message.body).toBe(getChronicleLine('2026-10-22').text)
    expect(message.expiresAt).toBe(new Date('2026-10-22T03:30:00Z').getTime())
    expect(pushMessage(defaultPushSchedule, new Date('2026-10-22T03:30:00Z'))).toBeNull()
  })
  it('sends only at the four default hours, merges overlapping quote/reminder times', () => {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date(Date.UTC(2026, 9, 22, hour) - 330 * 60_000)
      expect(!!pushMessage(defaultPushSchedule, date)).toBe([0, 2, 8, 22].includes(hour))
    }
    expect(pushMessage({ quoteHour: 8, reminderHours: [8, 0, 2] }, new Date('2026-10-22T02:30:00Z'))?.body).toContain('Take a moment')
  })
  it('honors finite and indefinite profile pauses without changing records', () => {
    const state = { trackingPauses: [{ startDate: '2026-10-21', endDate: '2026-10-22' }] }
    expect(profilePaused(state, '2026-10-22')).toBe(true)
    expect(profilePaused(state, '2026-10-23')).toBe(false)
    expect(profilePaused({ trackingPauses: [{ startDate: '2026-10-21', endDate: null }] }, '2027-01-01')).toBe(true)
  })
  it('uses 24 once-daily Hobby-compatible jobs aligned with every IST hour', () => {
    expect(config.crons).toHaveLength(24)
    config.crons.forEach((job, hour) => {
      expect(job.schedule).toBe(`30 ${(hour + 18) % 24} * * *`)
      expect(job.path).toBe(`/api/cramble-push?action=dispatch&hour=${hour}`)
    })
  })
})
