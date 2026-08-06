import type { CSSProperties } from 'react'
import { ChevronLeft, Sword } from 'lucide-react'
import {
  getCrambleChapterProgress,
  getCrambleJourneyProgress,
} from '@/lib/crambleGame'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
}

export function ObservatoryPage({ game, onBack }: Props) {
  const headingRef = usePageHeadingFocus()
  const chapter = getCrambleChapterProgress(game)
  const journey = getCrambleJourneyProgress(game)
  const displayedRenown = Math.min(
    Math.max(0, game.totalFlowers),
    chapter.targetRenown,
  )
  const displayedRank = Math.min(chapter.level, chapter.targetLevel)
  const sceneStyle = {
    '--knight-left': `${journey.knightLeftPercent}%`,
    '--knight-bottom': `${journey.knightBottomPercent}%`,
    '--knight-scale': journey.knightScale,
    '--horizon-light': 0.16 + journey.ratio * 0.42,
  } as CSSProperties

  return (
    <div className="cramble-observatory-shell mx-auto min-h-full w-full max-w-md overflow-hidden px-5 pb-10 pt-6 text-white">
      <div className="cramble-observatory-sky" aria-hidden="true" />

      <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Cramble's tracker"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-sm outline-none backdrop-blur transition active:scale-95 focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
          Lantern Observatory
        </span>
      </div>

      <header className="relative z-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--observatory-gold)]">
          The Sunward Archive
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-3xl font-semibold tracking-tight outline-none"
        >
          The road remembers every step
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/68">
          Two travelers begin beside one fire. Each completed lesson carries the
          knight farther along the eastern road, toward the light beyond the
          ridge.
        </p>
      </header>

      <section
        className="cramble-journey-stage relative z-10 mt-7"
        style={sceneStyle}
        role="img"
        aria-label={`A twilight road with two travelers. Cramble's journey is ${journey.percent}% complete at rank ${chapter.level}.`}
      >
        <div className="cramble-journey-scene" aria-hidden="true">
          <span className="cramble-journey-dawn" />
          <span className="cramble-journey-cloud cramble-journey-cloud-one" />
          <span className="cramble-journey-cloud cramble-journey-cloud-two" />
          <span className="cramble-journey-mountain cramble-journey-mountain-far" />
          <span className="cramble-journey-mountain cramble-journey-mountain-near" />
          <span className="cramble-journey-road" />
          <span className="cramble-journey-ridge" />

          <span className="cramble-journey-pines cramble-journey-pines-left">
            <i />
            <i />
            <i />
          </span>
          <span className="cramble-journey-pines cramble-journey-pines-right">
            <i />
            <i />
          </span>

          <span className="cramble-journey-gate">
            <i />
            <i />
          </span>
          <span className="cramble-journey-lantern">
            <i />
          </span>
          <span className="cramble-journey-fire">
            <i />
            <i />
          </span>

          <span className="cramble-journey-figure cramble-journey-woman">
            <span className="cramble-journey-woman-head" />
            <span className="cramble-journey-woman-cloak" />
          </span>

          <span className="cramble-journey-figure cramble-journey-knight">
            <span className="cramble-journey-knight-helmet" />
            <span className="cramble-journey-knight-cloak" />
            <span className="cramble-journey-knight-legs" />
            <Sword className="cramble-journey-knight-sword" />
          </span>
        </div>
      </section>

      <p className="relative z-10 mt-3 text-center text-xs font-medium text-white/64">
        Rank {chapter.level} · {journey.percent}% of the Sunward Road crossed ·{' '}
        {journey.landmark}
      </p>

      <section className="relative z-10 mt-6 rounded-[24px] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--observatory-gold)]">
              Chapter {chapter.chapterNumber}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{chapter.title}</h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums">
            {journey.percent}%
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-white/64">
            <span>Sunward journey</span>
            <span>{journey.landmark}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[color:var(--observatory-gold)] transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${journey.percent}%` }}
              role="progressbar"
              aria-label="Cramble's Sunward Road progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={journey.percent}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-control border border-white/10 bg-black/10 p-3">
            <p className="text-xs text-white/55">Renown</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {displayedRenown}/{chapter.targetRenown}
            </p>
          </div>
          <div className="rounded-control border border-white/10 bg-black/10 p-3">
            <p className="text-xs text-white/55">Archive rank</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {displayedRank}/{chapter.targetLevel}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/68">
          {journey.note}
        </p>
      </section>
    </div>
  )
}
