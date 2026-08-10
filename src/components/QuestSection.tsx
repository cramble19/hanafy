import type { Quest } from '@/types'
import { QuestCard, type PeriodGoalProgress } from './QuestCard'

type Props = {
  title: string
  quests: Quest[]
  checkedIds: Record<string, boolean>
  skippedIds?: Record<string, boolean>
  variant?: 'garden' | 'archive'
  periodProgressById?: Record<string, PeriodGoalProgress>
  onOpenInfo?: (id: string) => void
  onToggle: (id: string) => void
}

export function QuestSection({
  title,
  quests,
  checkedIds,
  skippedIds = {},
  variant = 'garden',
  periodProgressById = {},
  onOpenInfo,
  onToggle,
}: Props) {
  if (!quests.length) return null
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <div
          className={
            variant === 'archive'
              ? 'section-sigil-divider'
              : 'section-bloom-divider'
          }
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="space-y-3">
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            checked={Boolean(checkedIds[quest.id])}
            skipped={Boolean(skippedIds[quest.id])}
            variant={variant}
            periodProgress={periodProgressById[quest.id]}
            onOpenInfo={onOpenInfo}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  )
}
