import { describe, expect, it } from 'vitest'
import {
  getLogicalDayKey,
  getLogicalDayReminderAt,
  isLogicalDayReminderDue,
  millisecondsUntilNextLogicalDay,
} from './logicalDay'

describe('4 AM logical day', () => {
  it.each([
    [new Date(2026, 7, 6, 23, 59, 59, 999), '2026-08-06'],
    [new Date(2026, 7, 7, 0, 0, 0, 0), '2026-08-06'],
    [new Date(2026, 7, 7, 3, 59, 59, 999), '2026-08-06'],
    [new Date(2026, 7, 7, 4, 0, 0, 0), '2026-08-07'],
    [new Date(2027, 0, 1, 3, 59, 0, 0), '2026-12-31'],
  ])('maps %s to tracking day %s', (instant, expected) => {
    expect(getLogicalDayKey(instant)).toBe(expected)
  })

  it('places after-midnight reminders at the end of the same tracking day', () => {
    const lateEvening = getLogicalDayReminderAt('2026-08-06', '21:00')
    const afterMidnight = getLogicalDayReminderAt('2026-08-06', '02:00')

    expect(lateEvening).toEqual(new Date(2026, 7, 6, 21, 0, 0, 0))
    expect(afterMidnight).toEqual(new Date(2026, 7, 7, 2, 0, 0, 0))
  })

  it('schedules the next rollover at the next local 4 AM boundary', () => {
    expect(
      millisecondsUntilNextLogicalDay(new Date(2026, 7, 7, 3, 59, 30)),
    ).toBe(30_000)
    expect(
      millisecondsUntilNextLogicalDay(new Date(2026, 7, 7, 4, 0, 0)),
    ).toBe(24 * 60 * 60 * 1000)
    expect(
      millisecondsUntilNextLogicalDay(new Date(2026, 7, 7, 23, 0, 0)),
    ).toBe(5 * 60 * 60 * 1000)
  })

  it('catches up an evening reminder after midnight without firing a later reminder early', () => {
    const oneAm = new Date(2026, 7, 7, 1, 0, 0, 0)

    expect(isLogicalDayReminderDue(oneAm, '2026-08-06', '21:00')).toBe(true)
    expect(isLogicalDayReminderDue(oneAm, '2026-08-06', '02:00')).toBe(false)
    expect(
      isLogicalDayReminderDue(
        new Date(2026, 7, 7, 2, 0, 0, 0),
        '2026-08-06',
        '02:00',
      ),
    ).toBe(true)
  })

  it('rejects malformed reminder dates and times', () => {
    expect(getLogicalDayReminderAt('2026-02-30', '21:00')).toBeNull()
    expect(getLogicalDayReminderAt('2026-08-06', '24:00')).toBeNull()
  })
})
