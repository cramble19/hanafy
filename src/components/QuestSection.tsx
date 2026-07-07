import type { Quest } from '@/types'
import { QuestCard } from './QuestCard'

type Props = {
  title: string
  quests: Quest[]
  checkedIds: Record<string, boolean>
  skippedIds?: Record<string, boolean>
  canSkip?: boolean
  metaById?: Record<string, string>
  onToggle: (id: string) => void
  onSkip: (id: string) => void
}

export function QuestSection({
  title,
  quests,
  checkedIds,
  skippedIds = {},
  canSkip = false,
  metaById = {},
  onToggle,
  onSkip,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
      <div className="space-y-3">
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            checked={Boolean(checkedIds[quest.id])}
            skipped={Boolean(skippedIds[quest.id])}
            canSkip={canSkip}
            meta={metaById[quest.id]}
            onToggle={onToggle}
            onSkip={onSkip}
          />
        ))}
      </div>
    </section>
  )
}
