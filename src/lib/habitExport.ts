import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { flowersForQuest, getQuestCatalog } from '@/lib/hanaGame'
import { formatQuestCadence, getHabitRangeStats } from '@/lib/hanaStats'
import {
  getActiveHabitPause,
  getActiveProfilePause,
  getHabitSettings,
  isHabitArchivedOnDate,
} from '@/lib/habitLifecycle'
import type { HanaGameState, Quest } from '@/types'
import { LOGICAL_DAY_START_HOUR } from '@/lib/logicalDay'

const HEADERS = [
  'profile',
  'tracking_day_start',
  'record_type',
  'habit_id',
  'habit_name',
  'cadence',
  'date',
  'period_start',
  'period_end',
  'record_count',
  'target',
  'status',
  'difficulty',
  'points_earned',
  'cue',
  'reminder_time',
  'lifecycle',
  'pause_reason',
  'pause_note',
  'recorded_at',
  'backfilled',
  'change',
] as const

type CsvRow = Record<(typeof HEADERS)[number], string | number | boolean>

export function buildProfileCsv(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  const rows: CsvRow[] = []
  const catalog = getQuestCatalog(baseQuests, state)

  catalog.forEach((quest) => {
    const settings = getHabitSettings(state, quest.id)
    const lifecycle = isHabitArchivedOnDate(state, quest.id)
      ? 'archived'
      : getActiveProfilePause(state) || getActiveHabitPause(state, quest.id)
        ? 'paused'
        : 'active'
    const common = {
      profile: profileId,
      tracking_day_start: formatTrackingDayStart(),
      habit_id: quest.id,
      habit_name: quest.title,
      cadence: formatQuestCadence(quest),
      difficulty: quest.difficulty,
      cue: settings.cue,
      reminder_time:
        settings.reminder.enabled && settings.reminder.time
          ? settings.reminder.time
          : '',
      lifecycle,
    }

    rows.push({
      ...emptyRow(),
      ...common,
      record_type: 'habit',
      status: lifecycle,
    })

    const stats = getHabitRangeStats(
      state,
      baseQuests,
      profileId,
      quest.id,
      'all',
    )
    stats?.periods.forEach((period) => {
      const profilePause = findIntersectingPause(
        state.trackingPauses ?? [],
        period.startDate,
        period.endDate,
      )
      const habitPause = findIntersectingPause(
        settings.pauses,
        period.startDate,
        period.endDate,
      )
      rows.push({
        ...emptyRow(),
        ...common,
        record_type: 'period',
        period_start: period.startDate,
        period_end: period.endDate,
        record_count: period.completed,
        target: period.target,
        status: period.status,
        points_earned: getPeriodPoints(quest, period.completed, period.status),
        pause_reason:
          habitPause?.reason ??
          profilePause?.reason ??
          (period.status === 'paused' && settings.archivedAt ? 'archived' : ''),
        pause_note: habitPause?.note ?? profilePause?.note ?? '',
      })
    })

    settings.pauses.forEach((pause) => {
      rows.push({
        ...emptyRow(),
        ...common,
        record_type: 'habit_pause',
        period_start: pause.startDate,
        period_end: pause.endDate ?? '',
        status: 'neutral',
        pause_reason: pause.reason,
        pause_note: pause.note ?? '',
        recorded_at: pause.recordedAt,
      })
    })

    const habitAudit = (state.backfillAudit ?? []).filter(
      (event) => event.habitId === quest.id,
    )

    stats?.days
      .filter((day) => day.count > 0)
      .forEach((day) => {
        const dayAudit = habitAudit.filter(
          (event) => event.performedDate === day.dateKey,
        )
        const latestAudit = dayAudit.at(-1)
        rows.push({
          ...emptyRow(),
          ...common,
          record_type: 'occurrence',
          date: day.dateKey,
          record_count: day.count,
          status: 'recorded',
          recorded_at: latestAudit?.recordedAt ?? '',
          backfilled: dayAudit.length > 0,
        })
      })

    habitAudit.forEach((event) => {
      rows.push({
        ...emptyRow(),
        ...common,
        record_type: 'backfill_event',
        date: event.performedDate,
        status: event.delta === 1 ? 'added' : 'undone',
        recorded_at: event.recordedAt,
        backfilled: true,
        change: event.delta,
      })
    })
  })

  ;(state.trackingPauses ?? []).forEach((pause) => {
    rows.push({
      ...emptyRow(),
      profile: profileId,
      tracking_day_start: formatTrackingDayStart(),
      record_type: 'profile_pause',
      period_start: pause.startDate,
      period_end: pause.endDate ?? '',
      status: 'neutral',
      pause_reason: pause.reason,
      pause_note: pause.note ?? '',
      recorded_at: pause.recordedAt,
    })
  })

  return [
    HEADERS.join(','),
    ...rows.map((row) => HEADERS.map((header) => csvCell(row[header])).join(',')),
  ].join('\r\n')
}

function getPeriodPoints(
  quest: Quest,
  completed: number,
  status: string,
) {
  if (quest.schedule?.kind === 'quota') {
    return Math.min(completed, quest.schedule.target) * flowersForQuest(quest)
  }
  return status === 'completed' ? flowersForQuest(quest) : 0
}

function findIntersectingPause(
  pauses: ReturnType<typeof getHabitSettings>['pauses'],
  startDate: string,
  endDate: string,
) {
  return [...pauses]
    .reverse()
    .find(
      (pause) =>
        pause.startDate <= endDate &&
        (!pause.endDate || pause.endDate >= startDate),
    )
}

export function downloadProfileCsv(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  const csv = buildProfileCsv(state, baseQuests, profileId)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${profileId}-habits-${state.currentDate}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function emptyRow(): CsvRow {
  return Object.fromEntries(HEADERS.map((header) => [header, ''])) as CsvRow
}

function formatTrackingDayStart() {
  return `${String(LOGICAL_DAY_START_HOUR).padStart(2, '0')}:00 local`
}

function csvCell(value: string | number | boolean) {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
