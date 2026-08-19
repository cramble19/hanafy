import { Info } from 'lucide-react'
import type { Quest } from '@/types'

export type PeriodGoalProgress = {
  completed: number
  completedToday: number
  target: number
  isComplete: boolean
}

type Props = {
  quest: Quest
  checked: boolean
  skipped: boolean
  variant?: 'garden' | 'archive'
  periodProgress?: PeriodGoalProgress
  onOpenInfo?: (id: string) => void
  onToggle: (id: string) => void
}

export function QuestCard({
  quest,
  checked,
  skipped,
  variant = 'garden',
  periodProgress,
  onOpenInfo,
  onToggle,
}: Props) {
  const hasPeriodTarget = quest.schedule?.kind === 'periodTarget'
  const periodPercent = periodProgress
    ? Math.min(
        100,
        Math.round((periodProgress.completed / periodProgress.target) * 100),
      )
    : 0
  const actionLabel = skipped
    ? variant === 'archive'
      ? 'Neutral period · Passed'
      : 'Neutral period · Skipped'
    : checked
      ? variant === 'archive'
        ? 'Victory recorded'
        : 'Done today'
      : hasPeriodTarget && periodProgress
        ? `Record +1 · ${periodProgress.completed} of ${periodProgress.target}`
        : variant === 'archive'
          ? 'Record victory'
          : 'Complete today'

  return (
    <article
      className={`quest-card-clean rounded-card border bg-surface p-3 shadow-sm ${variant === 'archive' ? 'cramble-quest-card' : ''} ${checked ? 'quest-card-complete border-transparent' : skipped ? 'quest-card-skipped border-border' : 'border-border'}`}
      data-completed={checked}
      data-state={checked ? 'completed' : skipped ? 'skipped' : 'remaining'}
    >
      {checked ? (
        <span className="quest-bloom-sparkles" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="quest-card-emblem flex size-12 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{
            backgroundColor: `${quest.color}1a`,
            boxShadow: `inset 0 0 0 1.5px ${quest.color}66`,
          }}
        >
          {quest.emoji}
        </span>
        <span className="quest-card-copy min-w-0 flex-1 py-0.5">
          <span className="block text-lg font-medium leading-6 text-ink">
            {quest.title}
          </span>
          <span className="mt-0.5 block text-sm leading-5 text-muted">
            {quest.description}
          </span>
        </span>
        {onOpenInfo ? (
          <button
            type="button"
            onClick={() => onOpenInfo(quest.id)}
            aria-label={`Information for ${quest.title}`}
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {hasPeriodTarget && periodProgress ? (
        <span className="quest-period-progress mt-3" aria-hidden="true">
          <span
            className="quest-period-progress-fill"
            style={{ width: `${periodPercent}%` }}
          />
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onToggle(quest.id)}
        disabled={skipped || (hasPeriodTarget && checked)}
        aria-pressed={hasPeriodTarget ? undefined : checked}
        aria-label={
          skipped
            ? `${quest.title} is neutral for this period`
            : checked
              ? `Undo today's completion for ${quest.title}`
              : hasPeriodTarget && periodProgress
                ? `Record one completion for ${quest.title}. Currently ${periodProgress.completed} of ${periodProgress.target}`
                : `Mark ${quest.title} complete`
        }
        className="quest-card-clean-action mt-3 min-h-11 w-full rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink outline-none transition active:scale-[0.99] disabled:cursor-default disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
      >
        {actionLabel}
      </button>
    </article>
  )
}
