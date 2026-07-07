export type QuestGroup = 'daily' | 'longTerm'
export type Difficulty = 'easy' | 'medium' | 'hard'

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
}

export type GardenWeed = {
  id: string
  emoji: string
  title: string
  description: string
}

export type HanaGameState = {
  currentDate: string
  activeDailyQuests: Record<string, string[]>
  activeLongTermQuestIds: string[]
  dailyCompletions: Record<string, Record<string, boolean>>
  longTermWindows: Record<string, string>
  longTermCompletions: Record<string, Record<string, boolean>>
  questSkips: Record<string, Record<string, boolean>>
  eveningWeeds: Record<string, Record<string, boolean>>
  totalFlowers: number
}
