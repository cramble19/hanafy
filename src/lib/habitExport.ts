import type { HanaProfileId } from '@/lib/hanaCloudSync'
import {
  flowersForQuest,
  getQuestCatalog,
  recomputeTotalFlowers,
} from '@/lib/hanaGame'
import { formatQuestCadence, getHabitRangeStats } from '@/lib/hanaStats'
import {
  getActiveHabitPause,
  getActiveProfilePause,
  getHabitSettings,
  isHabitArchivedOnDate,
  isHabitGraduatedOnDate,
} from '@/lib/habitLifecycle'
import type { HanaGameState, Quest } from '@/types'
import { LOGICAL_DAY_START_HOUR } from '@/lib/logicalDay'
import { getOpenActivityCatalog } from '@/lib/openActivities'
import { getQuestCompletionProgress } from '@/lib/questCompletion'
import { describeQuestCompletionCriteria } from '@/lib/questCompletionRules'

const HEADERS = [
  'profile',
  'tracking_day_start',
  'record_type',
  'habit_id',
  'habit_name',
  'description',
  'cadence',
  'tracker_type',
  'activity_kind',
  'unit',
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
  'completion_criteria',
  'completion_progress',
  'graduated_on',
  'pause_reason',
  'pause_note',
  'recorded_at',
  'backfilled',
  'change',
] as const

type CsvRow = Record<(typeof HEADERS)[number], string | number | boolean>

export const PROFILE_BACKUP_FORMAT = 'hanafy-profile-backup' as const
export const PROFILE_BACKUP_FORMAT_VERSION = 3 as const

export type ProfileBackup = {
  format: typeof PROFILE_BACKUP_FORMAT
  formatVersion: typeof PROFILE_BACKUP_FORMAT_VERSION
  exportedAt: string
  profile: {
    id: HanaProfileId
    name: string
    rewardUnit: 'flowers' | 'renown'
  }
  trackingClock: {
    dayStartsAt: string
    timeZone: string
  }
  source: {
    stateSchemaVersion: number
    databaseRevision: number | null
    logicalDate: string
    storedPoints: number
    recomputedPoints: number
  }
  catalog: {
    habits: Array<Quest & {
      lifecycle: 'active' | 'paused' | 'archived' | 'graduated' | 'legacy'
      archivedAt: string | null
    }>
    anytimeActivities: Array<ReturnType<typeof getOpenActivityCatalog>[number] & {
      lifecycle: 'active' | 'paused' | 'archived'
      archivedAt: string | null
    }>
  }
  state: Omit<HanaGameState, 'syncRevision'>
}

type ProfileBackupOptions = {
  exportedAt?: string
  timeZone?: string
}

/**
 * Builds a self-describing, profile-scoped backup. Source-defined habits are
 * embedded alongside the saved state so the history remains understandable if
 * the app's built-in catalog changes later. The server's optimistic-lock
 * revision is metadata, never importable state.
 */
export function buildProfileBackup(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
  options: ProfileBackupOptions = {},
): ProfileBackup {
  const catalog = getQuestCatalog(baseQuests, state)
  const profilePause = getActiveProfilePause(state)
  const { syncRevision, ...portableState } = state

  return {
    format: PROFILE_BACKUP_FORMAT,
    formatVersion: PROFILE_BACKUP_FORMAT_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    profile: {
      id: profileId,
      name: profileId === 'hana' ? 'Hana' : 'Cramble',
      rewardUnit: profileId === 'hana' ? 'flowers' : 'renown',
    },
    trackingClock: {
      dayStartsAt: `${String(LOGICAL_DAY_START_HOUR).padStart(2, '0')}:00`,
      timeZone: options.timeZone ?? getLocalTimeZone(),
    },
    source: {
      stateSchemaVersion: state.schemaVersion ?? 4,
      databaseRevision: syncRevision ?? null,
      logicalDate: state.currentDate,
      storedPoints: state.totalFlowers,
      recomputedPoints: recomputeTotalFlowers(state, baseQuests),
    },
    catalog: {
      habits: catalog.map((quest) => {
        const settings = getHabitSettings(state, quest.id)
        return {
          ...quest,
          lifecycle: isHabitArchivedOnDate(state, quest.id)
            ? 'archived'
            : isHabitGraduatedOnDate(state, quest.id)
              ? 'graduated'
              : quest.catalogState === 'legacy'
                ? 'legacy'
            : profilePause || getActiveHabitPause(state, quest.id)
              ? 'paused'
              : 'active',
          archivedAt: settings.archivedAt,
        }
      }),
      anytimeActivities: getOpenActivityCatalog(state).map((activity) => {
        const settings = getHabitSettings(state, activity.id)
        return {
          ...activity,
          lifecycle: isHabitArchivedOnDate(state, activity.id)
            ? 'archived'
            : profilePause || getActiveHabitPause(state, activity.id)
              ? 'paused'
              : 'active',
          archivedAt: settings.archivedAt,
        }
      }),
    },
    state: portableState,
  }
}

export function buildProfileJson(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
  options: ProfileBackupOptions = {},
) {
  return JSON.stringify(
    buildProfileBackup(state, baseQuests, profileId, options),
    null,
    2,
  )
}

export function buildProfileCsv(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  const rows: CsvRow[] = []
  const catalog = getQuestCatalog(baseQuests, state)

  catalog.forEach((quest) => {
    const settings = getHabitSettings(state, quest.id)
    const completion = getQuestCompletionProgress(
      state,
      baseQuests,
      profileId,
      quest,
    )
    const lifecycle = isHabitArchivedOnDate(state, quest.id)
      ? 'archived'
      : isHabitGraduatedOnDate(state, quest.id)
        ? 'graduated'
        : quest.catalogState === 'legacy'
          ? 'legacy'
      : getActiveProfilePause(state) || getActiveHabitPause(state, quest.id)
        ? 'paused'
        : 'active'
    const common = {
      profile: profileId,
      tracking_day_start: formatTrackingDayStart(),
      habit_id: quest.id,
      habit_name: quest.title,
      description: quest.description,
      cadence: formatQuestCadence(quest),
      tracker_type: 'scheduled',
      activity_kind: '',
      unit: '',
      difficulty: quest.difficulty,
      cue: settings.cue,
      reminder_time:
        settings.reminder.enabled && settings.reminder.time
          ? settings.reminder.time
          : '',
      lifecycle,
      completion_criteria: describeQuestCompletionCriteria(
        completion.criteria,
      ),
      completion_progress: completion.paths
        .map((path) => `${path.kind}:${path.current}/${path.target}`)
        .join(' | '),
      graduated_on: settings.completion.graduation?.effectiveDate ?? '',
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

  getOpenActivityCatalog(state).forEach((activity) => {
    const settings = getHabitSettings(state, activity.id)
    const lifecycle = isHabitArchivedOnDate(state, activity.id)
      ? 'archived'
      : getActiveProfilePause(state) || getActiveHabitPause(state, activity.id)
        ? 'paused'
        : 'active'
    const common = {
      profile: profileId,
      tracking_day_start: formatTrackingDayStart(),
      habit_id: activity.id,
      habit_name: activity.title,
      description: activity.description,
      cadence:
        activity.kind === 'check'
          ? 'Anytime · Once today'
          : 'Anytime · Count',
      tracker_type: 'anytime',
      activity_kind: activity.kind,
      unit: activity.unit ?? '',
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
      record_type: 'anytime_activity',
      status: lifecycle,
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

    const activityAudit = (state.backfillAudit ?? []).filter(
      (event) => event.habitId === activity.id,
    )

    Object.entries(state.openActivityLogs ?? {})
      .filter(([, logs]) => (logs[activity.id] ?? 0) > 0)
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
      .forEach(([dateKey, logs]) => {
        const dayAudit = activityAudit.filter(
          (event) => event.performedDate === dateKey,
        )
        rows.push({
          ...emptyRow(),
          ...common,
          record_type: 'anytime_log',
          date: dateKey,
          record_count:
            activity.kind === 'check' ? 1 : logs[activity.id],
          status: 'logged',
          points_earned: 0,
          recorded_at: dayAudit.at(-1)?.recordedAt ?? '',
          backfilled: dayAudit.length > 0,
        })
      })

    activityAudit.forEach((event) => {
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
  downloadTextFile(
    `\uFEFF${csv}`,
    'text/csv;charset=utf-8',
    `${profileId}-habits-${state.currentDate}.csv`,
  )
}

export function downloadProfileJson(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  downloadTextFile(
    buildProfileJson(state, baseQuests, profileId),
    'application/json;charset=utf-8',
    `${profileId}-backup-${state.currentDate}.json`,
  )
}

export function downloadTextFile(
  contents: string,
  mimeType: string,
  filename: string,
) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
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

function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  } catch {
    return 'local'
  }
}

function csvCell(value: string | number | boolean) {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
