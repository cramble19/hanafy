import type { Difficulty, Quest } from '@/types'
import { flowersForQuest } from '@/lib/hanaGame'
import { HabitMomentumBadge } from '@/components/HabitMomentumBadge'
import type { HabitMomentumSignal } from '@/lib/hanaStats'

const difficultyLabel: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

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
  canSkip: boolean
  meta?: string
  variant?: 'garden' | 'archive'
  rewardSingular?: string
  rewardPlural?: string
  completionVerb?: string
  skipLabel?: string
  skippedLabel?: string
  periodProgress?: PeriodGoalProgress
  momentum?: HabitMomentumSignal | null
  onToggle: (id: string) => void
  onUndoOccurrence?: (id: string) => void
  onSkip: (id: string) => void
}

export function QuestCard({
  quest,
  checked,
  skipped,
  canSkip,
  meta,
  variant = 'garden',
  rewardSingular = 'flower',
  rewardPlural = 'flowers',
  completionVerb = 'planted',
  skipLabel = 'Skip',
  skippedLabel = 'Skipped',
  periodProgress,
  momentum,
  onToggle,
  onUndoOccurrence,
  onSkip,
}: Props) {
  const reward = flowersForQuest(quest)
  const rewardLabel = reward === 1 ? rewardSingular : rewardPlural
  const hasPeriodTarget = quest.schedule?.kind === 'periodTarget'
  const hasFlexibleSchedule =
    hasPeriodTarget || quest.schedule?.kind === 'quota'
  const hasPartialProgress = Boolean(
    hasPeriodTarget &&
      periodProgress &&
      periodProgress.completed > 0 &&
      !periodProgress.isComplete,
  )
  const skipDisabled = checked || (!canSkip && !skipped)
  const periodPercent = periodProgress
    ? Math.min(100, Math.round((periodProgress.completed / periodProgress.target) * 100))
    : 0

  return (
    <div
      className={`relative flex w-full select-none items-stretch overflow-hidden rounded-card border bg-surface text-left shadow-sm transition motion-reduce:transition-none ${variant === 'archive' ? 'cramble-quest-card' : ''} ${hasPartialProgress ? 'quest-card-progress' : ''} ${
        checked
          ? 'quest-card-complete border-transparent'
          : skipped
            ? 'quest-card-skipped border-border'
            : 'border-border'
      }`}
    >
      {checked ? (
        <span className="quest-bloom-sparkles" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}
      {checked && hasPeriodTarget ? (
        <span className="sr-only" role="status" aria-live="polite">
          Goal complete. +{reward} {rewardLabel} earned.
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (!hasPeriodTarget || !checked) onToggle(quest.id)
        }}
        disabled={skipped}
        aria-disabled={hasPeriodTarget && checked ? true : undefined}
        aria-pressed={hasPeriodTarget ? undefined : checked}
        aria-label={
          hasPeriodTarget && periodProgress
            ? checked
              ? `${quest.title}. ${quest.description}. Period goal complete. ${meta ?? `${periodProgress.completed} of ${periodProgress.target}`}. ${reward} ${rewardLabel} earned.`
              : `Record one completion for ${quest.title}. ${quest.description}. ${meta ?? `Currently ${periodProgress.completed} of ${periodProgress.target}`}. Earn ${reward} ${rewardLabel} when the goal is complete.`
            : `${quest.title}. ${quest.description}. Worth ${reward} ${rewardLabel}.`
        }
        className="flex min-w-0 flex-1 items-center gap-3 p-3 pr-2 text-left outline-none transition active:bg-surface-2/50 disabled:cursor-default aria-disabled:cursor-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink motion-reduce:transition-none"
      >
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{
            backgroundColor: `${quest.color}1a`,
            boxShadow: `inset 0 0 0 1.5px ${quest.color}66`,
          }}
        >
          {quest.emoji}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-lg font-medium text-ink transition ${
              checked || skipped ? 'line-through opacity-50' : ''
            }`}
          >
            {quest.title}
          </span>
          <span
            className={`mt-0.5 block text-sm text-muted ${
              checked || skipped ? 'opacity-50' : ''
            }`}
          >
            {quest.description}
          </span>
          <span className="mt-1.5 inline-block text-[11px] font-medium uppercase tracking-wider text-faint">
            {difficultyLabel[quest.difficulty]}
          </span>
          <span className="ml-2 inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            +{reward} {rewardLabel}{hasPeriodTarget ? ' at goal' : ''}
          </span>
          {meta ? (
            <span className="ml-2 inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-faint">
              {meta}
            </span>
          ) : null}
          {momentum?.kind === 'combo' ? (
            <span className="ml-2 inline-flex align-middle">
              <HabitMomentumBadge
                signal={momentum}
                profile={variant === 'archive' ? 'cramble' : 'hana'}
                compact
              />
            </span>
          ) : null}
          {checked ? (
            <span className="quest-flower-feedback">
              +{reward} {rewardLabel} {hasPeriodTarget ? 'earned' : completionVerb}
            </span>
          ) : null}
          {hasPeriodTarget && periodProgress ? (
            <span className="quest-period-progress" aria-hidden="true">
              <span
                className="quest-period-progress-fill"
                style={{ width: `${periodPercent}%` }}
              />
            </span>
          ) : null}
          {hasPeriodTarget && !checked ? (
            <span className="quest-record-cue">Record +1</span>
          ) : null}
        </span>
      </button>

      <div className="flex shrink-0 flex-col items-center justify-center gap-2 py-3 pr-3">
        {checked ? (
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-ink">
            Done
          </span>
        ) : null}
        {hasPeriodTarget ? (
          periodProgress &&
          periodProgress.completedToday > 0 &&
          onUndoOccurrence ? (
            <button
              type="button"
              onClick={() => onUndoOccurrence(quest.id)}
              aria-label={`Undo one completion for ${quest.title}`}
              className="quest-undo-occurrence"
            >
              Undo one
            </button>
          ) : (
            <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface-2 px-3 py-1 text-center text-[11px] font-medium text-muted">
              Period goal
            </span>
          )
        ) : hasFlexibleSchedule ? (
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted">
            Flexible
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSkip(quest.id)}
            disabled={skipDisabled}
            aria-label={
              skipped
                ? `Undo ${skipLabel.toLowerCase()} for ${quest.title}`
                : `${skipLabel} ${quest.title}`
            }
            className={`min-h-11 min-w-11 rounded-full border px-3 py-1 text-[11px] font-medium outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink motion-reduce:transition-none ${
              skipped
                ? 'border-warning/40 bg-warning/15 text-ink'
                : 'border-border bg-surface-2 text-muted disabled:opacity-35'
            }`}
          >
            {skipped ? skippedLabel : skipLabel}
          </button>
        )}
      </div>
    </div>
  )
}
