import { quests } from '@/data/quests'
import { HabitLedgerPage } from '@/pages/CrambleLedgerPage'
import type { HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenQuest: (questId: string) => void
  onRestoreHabit?: (questId: string) => void
  onDeleteHabit?: (questId: string) => void
}

/**
 * Hana and Cramble share one period-aware Ledger engine. This wrapper keeps
 * Hana's catalog, copy, colors, and saved profile isolated from Cramble.
 */
export function StatsPage({ game, onBack, onOpenQuest, onRestoreHabit, onDeleteHabit }: Props) {
  return (
    <HabitLedgerPage
      game={game}
      baseQuests={quests}
      profileId="hana"
      onBack={onBack}
      onOpenQuest={onOpenQuest}
      onRestoreHabit={onRestoreHabit}
      onDeleteHabit={onDeleteHabit}
    />
  )
}
