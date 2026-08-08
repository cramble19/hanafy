export type QuestGroup = 'daily' | 'longTerm'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type QuestSchedule =
  | { kind: 'daily' }
  | { kind: 'weekly'; daysOfWeek: Weekday[] }
  | {
      /**
       * A counted goal that pays out once, only after every required
       * occurrence in the period has been recorded. Unlike legacy quotas,
       * multiple occurrences may be recorded on the same day.
       */
      kind: 'periodTarget'
      target: number
      periodDays: number
      anchor: 'calendarWeek' | 'questStart'
    }
  | {
      /** Legacy per-occurrence quota kept so existing saved habits stay stable. */
      kind: 'quota'
      target: number
      periodDays: 7
      anchor: 'calendarWeek'
    }
  | {
      kind: 'quota'
      target: number
      periodDays: number
      anchor: 'profileStart'
    }
  | {
      kind: 'quota'
      target: number
      periodDays: number
      anchor: 'questStart'
    }

export type Quest = {
  id: string
  emoji: string
  title: string
  description: string
  group: QuestGroup
  difficulty: Difficulty
  /** Per-habit accent color (hex) from the Calm Garden palette. */
  color: string
  /** Required quests always show up; optional quests rotate by date. */
  required?: boolean
  /** Quest unlock level. Defaults to 1. */
  minLevel?: number
  /** Long-term quests must be completed within this many days. */
  durationDays?: number
  /** When a daily-group quest appears. Omitted schedules remain daily. */
  schedule?: QuestSchedule
  /** User-created quests are persisted inside their owning profile state. */
  custom?: boolean
  /** Local creation date; also anchors custom rolling habit periods. */
  createdDate?: string
}

export type PauseReason =
  | 'rest'
  | 'illness'
  | 'period'
  | 'vacation'
  | 'travel'
  | 'overwhelmed'
  | 'scheduleChange'
  | 'other'

export type TrackingPause = {
  id: string
  /** First neutral tracking day; tracking days run from 04:00 to 03:59 local time. */
  startDate: string
  /** Last neutral tracking day. Null means paused until manually resumed. */
  endDate: string | null
  reason: PauseReason
  /** Private, optional context. Kept short because it may contain health data. */
  note?: string
  recordedAt: string
}

export type HabitReminder = {
  enabled: boolean
  /** Local wall-clock time in HH:mm. */
  time: string | null
}

export type HabitSettings = {
  /** Optional wording overrides for source-defined habits. */
  titleOverride?: string
  descriptionOverride?: string
  cue: string
  reminder: HabitReminder
  archivedAt: string | null
  pauses: TrackingPause[]
}

export type HabitBackfillEvent = {
  id: string
  habitId: string
  performedDate: string
  recordedAt: string
  delta: 1 | -1
}

export type CustomHabitQuest = Quest & {
  custom: true
  createdDate: string
  group: 'daily'
  required: true
  minLevel: 1
  schedule: QuestSchedule
}

/**
 * A deadline-free activity records what happened without creating a due date,
 * missed state, streak, or reward. `check` is binary for a logical day;
 * `count` stores a non-negative quantity for that logical day.
 */
export type OpenActivityKind = 'check' | 'count'

export type OpenActivity = {
  id: string
  custom: true
  title: string
  description: string
  emoji: string
  color: string
  kind: OpenActivityKind
  /** Optional display unit for counted activities, such as pages or sets. */
  unit: string | null
  /** Logical creation day. Tracker days run from 04:00 to 03:59 local time. */
  createdDate: string
}

export type NewOpenActivityInput = {
  title: string
  description: string
  kind: OpenActivityKind
  unit?: string | null
  emoji?: string
  color?: string
}

export type GardenWeed = {
  id: string
  emoji: string
  title: string
  description: string
}

export type GameState = {
  schemaVersion?: 3
  /** Null means this profile has not started its tracker yet. */
  startDate: string | null
  currentDate: string
  customHabits: CustomHabitQuest[]
  /** Tombstones for deleted built-in habits so they cannot reappear after reload. */
  deletedHabitIds?: string[]
  /** Changes only when all progress is reset; used to retire old DB projections. */
  historyEpoch?: string
  /** Server revision this full snapshot was based on; persisted with offline work. */
  syncRevision?: number
  /** Per-habit lifecycle and reminder intent, shared by built-in and custom habits. */
  habitSettings?: Record<string, HabitSettings>
  /** Deadline-free definitions. Lifecycle state is stored in habitSettings. */
  openActivities: OpenActivity[]
  /** Per-logical-day values. Check activities are 0/1; counts are safe integers. */
  openActivityLogs: Record<string, Record<string, number>>
  /** Profile-wide neutral intervals. */
  trackingPauses?: TrackingPause[]
  /** Provenance for corrections entered after their performed date. */
  backfillAudit?: HabitBackfillEvent[]
  activeDailyQuests: Record<string, string[]>
  activeLongTermQuestIds: string[]
  dailyCompletions: Record<string, Record<string, boolean>>
  /** Dated occurrence counts for period-target habits. */
  habitOccurrences: Record<string, Record<string, number>>
  longTermWindows: Record<string, string>
  longTermCompletions: Record<string, Record<string, boolean>>
  questSkips: Record<string, Record<string, boolean>>
  eveningWeeds: Record<string, Record<string, boolean>>
  totalFlowers: number
}

/** Kept as an alias so Hana's existing feature code and stored shape stay stable. */
export type HanaGameState = GameState
