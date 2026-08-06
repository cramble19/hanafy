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

export type CustomHabitQuest = Quest & {
  custom: true
  createdDate: string
  group: 'daily'
  required: true
  minLevel: 1
  schedule: QuestSchedule
}

export type GardenWeed = {
  id: string
  emoji: string
  title: string
  description: string
}

export type GameState = {
  /** Null means this profile has not started its tracker yet. */
  startDate: string | null
  currentDate: string
  customHabits: CustomHabitQuest[]
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
