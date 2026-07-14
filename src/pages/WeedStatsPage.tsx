import { ChevronLeft, ChevronRight, Leaf } from 'lucide-react'
import hanaWeeds from '@/data/hanaWeeds.json'
import { getWeedHistory } from '@/lib/hanaStats'
import type { GardenWeed, HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenWeed: (weedId: string) => void
}

const weeds = hanaWeeds as GardenWeed[]

export function WeedStatsPage({ game, onBack, onOpenWeed }: Props) {
  return (
    <div className="stats-page-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
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
          <Leaf className="size-3.5" />
          Evening weeds
        </span>
      </div>

      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
          Reflection trail
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Every weed pattern
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Tap any weed to see when it appeared. These are signals, not failures.
        </p>
      </header>

      <section className="space-y-3">
        {weeds.map((weed) => {
          const history = getWeedHistory(game, weed.id)
          return (
            <button
              key={weed.id}
              type="button"
              onClick={() => onOpenWeed(weed.id)}
              className="w-full rounded-card border border-border bg-surface/86 p-3 text-left shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/12 text-xl">
                  {weed.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">
                    {weed.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {history.checked} checks · {weed.description}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}
