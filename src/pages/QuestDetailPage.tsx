import { quests } from '@/data/quests'
import { HabitQuestDetailPage } from '@/pages/CrambleQuestDetailPage'
import type { HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  questId: string
  onBack: () => void
}

export function QuestDetailPage({ game, questId, onBack }: Props) {
  return (
    <HabitQuestDetailPage
      game={game}
      questId={questId}
      onBack={onBack}
      baseQuests={quests}
      profileId="hana"
    />
  )
}
