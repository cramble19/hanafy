import type { KeyboardEvent } from 'react'
import type { Difficulty, Quest } from '@/types'
import { flowersForQuest } from '@/lib/hanaGame'

const difficultyLabel: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

type Props = {
  quest: Quest
  checked: boolean
  skipped: boolean
  canSkip: boolean
  meta?: string
  onToggle: (id: string) => void
  onSkip: (id: string) => void
}

export function QuestCard({
  quest,
  checked,
  skipped,
  canSkip,
  meta,
  onToggle,
  onSkip,
}: Props) {
  const flowerReward = flowersForQuest(quest)
  const skipDisabled = checked || (!canSkip && !skipped)
  const toggleQuest = () => {
    if (!skipped) {
      onToggle(quest.id)
    }
  }
  const toggleQuestFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleQuest()
    }
  }

  return (
    <div
      role="button"
      tabIndex={skipped ? -1 : 0}
      onClick={toggleQuest}
      onKeyDown={toggleQuestFromKeyboard}
      aria-pressed={checked}
      aria-disabled={skipped}
      aria-label={`${quest.title}. ${quest.description}. Worth ${flowerReward} flowers.`}
      className={`relative flex w-full select-none items-center gap-3 overflow-hidden rounded-card border bg-surface p-3 text-left shadow-sm outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none ${
        checked
          ? 'quest-card-complete border-transparent'
          : skipped
            ? 'quest-card-skipped border-border'
            : 'border-border'
      } ${skipped ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {checked ? (
        <span className="quest-bloom-sparkles" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}
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
          +{flowerReward} {flowerReward === 1 ? 'flower' : 'flowers'}
        </span>
        {meta ? (
          <span className="ml-2 inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-faint">
            {meta}
          </span>
        ) : null}
        {checked ? (
          <span className="quest-flower-feedback">
            +{flowerReward} {flowerReward === 1 ? 'flower' : 'flowers'} planted
          </span>
        ) : null}
      </span>

      <div className="flex shrink-0 flex-col items-center gap-2">
        {checked ? (
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-ink">
            Done
          </span>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSkip(quest.id)
          }}
          onKeyDown={(event) => event.stopPropagation()}
          disabled={skipDisabled}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 motion-reduce:transition-none ${
            skipped
              ? 'border-warning/40 bg-warning/15 text-ink'
              : 'border-border bg-surface-2 text-muted disabled:opacity-35'
          }`}
        >
          {skipped ? 'Skipped' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
