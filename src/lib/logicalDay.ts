export const LOGICAL_DAY_START_HOUR = 4

/**
 * Returns the local tracking-day key for a wall-clock instant.
 * A tracking day starts at 04:00 and ends immediately before 04:00 the next
 * calendar day, so 01:30 on August 7 still belongs to August 6.
 */
export function getLogicalDayKey(date = new Date()) {
  const logicalDate = new Date(date)
  if (logicalDate.getHours() < LOGICAL_DAY_START_HOUR) {
    logicalDate.setDate(logicalDate.getDate() - 1)
  }
  return formatLocalDateKey(logicalDate)
}

/**
 * Resolves a reminder's wall-clock instant inside a tracking day. Times before
 * 04:00 occur on the following calendar date but retain the same logical key.
 */
export function getLogicalDayReminderAt(
  logicalDateKey: string,
  time: string,
) {
  const dateParts = parseDateKey(logicalDateKey)
  const timeParts = parseTime(time)
  if (!dateParts || !timeParts) return null

  const [year, month, day] = dateParts
  const [hours, minutes] = timeParts
  const reminderAt = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (hours < LOGICAL_DAY_START_HOUR) {
    reminderAt.setDate(reminderAt.getDate() + 1)
  }
  return reminderAt
}

export function isLogicalDayReminderDue(
  now: Date,
  logicalDateKey: string,
  time: string,
) {
  const reminderAt = getLogicalDayReminderAt(logicalDateKey, time)
  return Boolean(reminderAt && now.getTime() >= reminderAt.getTime())
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const parts = match.slice(1).map(Number) as [number, number, number]
  const [year, month, day] = parts
  const date = new Date(year, month - 1, day, 12)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return parts
}

function parseTime(value: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return [hours, minutes]
}
