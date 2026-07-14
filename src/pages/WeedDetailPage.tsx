import { CalendarDays, ChevronLeft, Leaf } from 'lucide-react'
import hanaWeeds from '@/data/hanaWeeds.json'
import { getCalendarWindow, getWeedHistory } from '@/lib/hanaStats'
import type { GardenWeed, HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  weedId: string
  onBack: () => void
}

const weeds = hanaWeeds as GardenWeed[]

export function WeedDetailPage({ game, weedId, onBack }: Props) {
  const weed = weeds.find((item) => item.id === weedId)
  const history = getWeedHistory(game, weedId)
  const checkedDates = new Set(history.dates)
  const calendarDays = getCalendarWindow(game.currentDate)

  return (
    <div className="stats-page-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to weeds"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/88 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
          Weed detail
        </span>
      </div>

      <header className="mb-5 rounded-card border border-border bg-surface/86 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-success/12 text-3xl">
            {weed?.emoji ?? '🌿'}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">
              Evening pattern
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {weed?.title ?? weedId}
            </h1>
            {weed ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                {weed.description}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <Metric label="Total checks" value={history.checked} />
        <Metric label="Last noticed" value={history.dates.at(-1) ? formatShortDate(history.dates.at(-1)!) : '-'} />
      </section>

      <section className="rounded-card border border-border bg-surface/86 p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <CalendarDays className="size-4 text-success" />
          Calendar trail
        </h2>
        <p className="mt-1 text-xs text-muted">
          Green days are days this weed was checked.
        </p>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {calendarDays.map((dateKey) => {
            const checked = checkedDates.has(dateKey)
            return (
              <div key={dateKey} className="text-center">
                <span
                  className={`stats-calendar-day ${checked ? 'stats-calendar-day-weed' : ''}`}
                  title={`${dateKey}${checked ? ': checked' : ''}`}
                >
                  {Number(dateKey.slice(-2))}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <p className="mt-5 rounded-card border border-border bg-surface/70 p-4 text-sm leading-6 text-muted shadow-sm">
        <Leaf className="mr-1 inline size-4 text-success" />
        This page is for noticing patterns gently, not for blame.
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-border bg-surface/86 p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
