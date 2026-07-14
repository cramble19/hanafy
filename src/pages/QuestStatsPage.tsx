import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { quests } from '@/data/quests'
import { getQuestHistory } from '@/lib/hanaStats'
import type { HanaGameState, Quest } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenQuest: (questId: string) => void
}

export function QuestStatsPage({ game, onBack, onOpenQuest }: Props) {
  const rows = quests.map((quest) => ({
    quest,
    history: getQuestHistory(game, quests, quest.id),
  }))

  return (
    <div className="stats-page-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
      <TopBar label="All quests" onBack={onBack} />
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
          Quest garden
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Every quest trail
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Tap any quest to see done days, skipped days, and its full rhythm.
        </p>
      </header>

      <section className="space-y-3">
        {rows.map(({ quest, history }) => (
          <QuestRow
            key={quest.id}
            quest={quest}
            completed={history.stat.completed}
            skipped={history.stat.skipped}
            shown={history.stat.shown}
            completionRate={history.stat.completionRate}
            onClick={() => onOpenQuest(quest.id)}
          />
        ))}
      </section>
    </div>
  )
}

function QuestRow({
  quest,
  completed,
  skipped,
  shown,
  completionRate,
  onClick,
}: {
  quest: Quest
  completed: number
  skipped: number
  shown: number
  completionRate: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-card border border-border bg-surface/86 p-3 text-left shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: `${quest.color}22` }}
          aria-hidden="true"
        >
          {quest.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">
            {quest.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {completed} done · {skipped} skipped · {shown} shown
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${completionRate}%` }}
            />
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums text-ink">
          {completionRate}%
          <ChevronRight className="size-4 text-faint" />
        </span>
      </div>
    </button>
  )
}

function TopBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to stats"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/88 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
        <Search className="size-3.5" />
        {label}
      </span>
    </div>
  )
}
