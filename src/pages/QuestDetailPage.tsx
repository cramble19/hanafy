import { CalendarDays, ChevronLeft } from 'lucide-react'
import { quests } from '@/data/quests'
import {
  getCalendarWindow,
  getQuestHistory,
  type QuestHistoryDay,
} from '@/lib/hanaStats'
import type { HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  questId: string
  onBack: () => void
}

export function QuestDetailPage({ game, questId, onBack }: Props) {
  const quest = quests.find((item) => item.id === questId)
  const history = getQuestHistory(game, quests, questId)
  const dayByDate = new Map(history.days.map((day) => [day.dateKey, day]))
  const calendarDays = getCalendarWindow(game.currentDate)

  return (
    <div className="stats-page-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
      <TopBack onBack={onBack} />
      <header className="mb-5 rounded-card border border-border bg-surface/86 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${history.stat.color}24` }}
            aria-hidden="true"
          >
            {history.stat.emoji}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">
              Quest trail
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {history.stat.title}
            </h1>
            {quest ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                {quest.description}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-3 gap-3">
        <Metric label="Done" value={history.stat.completed} />
        <Metric label="Skipped" value={history.stat.skipped} />
        <Metric label="Rate" value={`${history.stat.completionRate}%`} />
      </section>

      <section className="rounded-card border border-border bg-surface/86 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CalendarDays className="size-4 text-success" />
              Calendar trail
            </h2>
            <p className="mt-1 text-xs text-muted">
              Green means done. Gold means skipped. Pink means missed.
            </p>
          </div>
        </div>
        <CalendarGrid
          dates={calendarDays}
          getStatus={(dateKey) => dayByDate.get(dateKey)}
        />
      </section>
    </div>
  )
}

function CalendarGrid({
  dates,
  getStatus,
}: {
  dates: string[]
  getStatus: (dateKey: string) => QuestHistoryDay | undefined
}) {
  return (
    <div className="mt-4 grid grid-cols-7 gap-2">
      {dates.map((dateKey) => {
        const day = getStatus(dateKey)
        const dayNumber = Number(dateKey.slice(-2))
        return (
          <div key={dateKey} className="text-center">
            <span
              className={`stats-calendar-day ${getQuestDayClass(day?.status)}`}
              title={`${dateKey}${day ? `: ${day.status}` : ''}`}
            >
              {dayNumber}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function getQuestDayClass(status: QuestHistoryDay['status'] | undefined) {
  if (status === 'completed') {
    return 'stats-calendar-day-complete'
  }
  if (status === 'skipped') {
    return 'stats-calendar-day-skipped'
  }
  if (status === 'missed') {
    return 'stats-calendar-day-missed'
  }
  if (status === 'open') {
    return 'stats-calendar-day-open'
  }
  return ''
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-border bg-surface/86 p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function TopBack({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to quests"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/88 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
        Quest detail
      </span>
    </div>
  )
}
