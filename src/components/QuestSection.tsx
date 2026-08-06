import type { Quest } from '@/types'
import type { HabitMomentumSignal } from '@/lib/hanaStats'
import { QuestCard, type PeriodGoalProgress } from './QuestCard'

type Props = {
  title: string
  quests: Quest[]
  checkedIds: Record<string, boolean>
  skippedIds?: Record<string, boolean>
  canSkip?: boolean
  metaById?: Record<string, string>
  variant?: 'garden' | 'archive'
  rewardSingular?: string
  rewardPlural?: string
  completionVerb?: string
  skipLabel?: string
  skippedLabel?: string
  periodProgressById?: Record<string, PeriodGoalProgress>
  momentumById?: Record<string, HabitMomentumSignal | null>
  onToggle: (id: string) => void
  onUndoOccurrence?: (id: string) => void
  onSkip: (id: string) => void
}

export function QuestSection({
  title,
  quests,
  checkedIds,
  skippedIds = {},
  canSkip = false,
  metaById = {},
  variant = 'garden',
  rewardSingular = 'flower',
  rewardPlural = 'flowers',
  completionVerb = 'planted',
  skipLabel = 'Skip',
  skippedLabel = 'Skipped',
  periodProgressById = {},
  momentumById = {},
  onToggle,
  onUndoOccurrence,
  onSkip,
}: Props) {
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
            canSkip={canSkip}
            meta={metaById[quest.id]}
            variant={variant}
            rewardSingular={rewardSingular}
            rewardPlural={rewardPlural}
            completionVerb={completionVerb}
            skipLabel={skipLabel}
            skippedLabel={skippedLabel}
            periodProgress={periodProgressById[quest.id]}
            momentum={momentumById[quest.id]}
            onToggle={onToggle}
            onUndoOccurrence={onUndoOccurrence}
            onSkip={onSkip}
          />
        ))}
      </div>
    </section>
  )
}
