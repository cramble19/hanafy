import { Check } from 'lucide-react'
import type { GardenWeed } from '@/types'

type Props = {
  weeds: GardenWeed[]
  checkedIds: Record<string, boolean>
  weedsTowardNextWilt: number
  weedsPerWiltedFlower: number
  wiltedFlowers: number
  onToggle: (id: string) => void
}

export function EveningWeeds({
  weeds,
  checkedIds,
  weedsTowardNextWilt,
  weedsPerWiltedFlower,
  wiltedFlowers,
  onToggle,
}: Props) {
  const checkedToday = weeds.filter((weed) => checkedIds[weed.id]).length

  return (
    <section className="space-y-3">
      <div className="px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Evening Weeds</h2>
          <span className="text-sm tabular-nums text-muted">
            {checkedToday}/{weeds.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Gentle honesty check. Every {weedsPerWiltedFlower} weeds wilt 1 flower.
        </p>
        <p className="mt-1 text-xs text-faint">
          {wiltedFlowers > 0
            ? `${wiltedFlowers} flower${wiltedFlowers === 1 ? '' : 's'} wilted so far.`
            : `${weedsTowardNextWilt}/${weedsPerWiltedFlower} toward the first wilt.`}
        </p>
      </div>

      <div className="space-y-3">
        {weeds.map((weed) => {
          const checked = Boolean(checkedIds[weed.id])

          return (
            <button
              key={weed.id}
              type="button"
              onClick={() => onToggle(weed.id)}
              aria-pressed={checked}
              aria-label={`${weed.title}. ${weed.description}`}
              className={`flex w-full cursor-pointer select-none items-center gap-4 rounded-card border bg-surface p-4 text-left shadow-sm outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none motion-reduce:active:scale-100 ${
                checked ? 'weed-card-checked border-transparent' : 'border-border'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xl"
              >
                {weed.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium text-ink">
                  {weed.title}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {weed.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  checked
                    ? 'border-danger bg-danger'
                    : 'border-[color:rgba(215,106,84,0.55)]'
                }`}
              >
                <Check
                  strokeWidth={3}
                  className={`size-4 text-white transition-opacity ${
                    checked ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
