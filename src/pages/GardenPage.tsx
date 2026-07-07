import { ChevronLeft } from 'lucide-react'
import {
  getLevelProgress,
  getSpringArcProgress,
  getWeedProgress,
} from '@/lib/hanaGame'
import type { HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
}

const STAR_POSITIONS = [
  [8, 18],
  [18, 10],
  [30, 22],
  [42, 12],
  [56, 19],
  [68, 9],
  [80, 23],
  [91, 14],
  [14, 33],
  [51, 34],
  [74, 36],
  [88, 31],
] as const

const FLOWER_COLORS = [
  ['#f7a6be', '#eea63a'],
  ['#d98ba0', '#f2b84b'],
  ['#9e8fd0', '#eea63a'],
  ['#f1b56f', '#d98ba0'],
  ['#8fb48a', '#f2b84b'],
] as const

export function GardenPage({ game, onBack }: Props) {
  const levelProgress = getLevelProgress(game.totalFlowers)
  const weedProgress = getWeedProgress(game)
  const springArc = getSpringArcProgress(game)
  const plantedCount = Math.min(game.totalFlowers, 48)
  const flowers = Array.from({ length: plantedCount })

  return (
    <div className="mx-auto min-h-full w-full max-w-md bg-[#0d1535] text-white">
      <div className="relative min-h-full overflow-hidden">
        <div className="garden-night-sky" aria-hidden="true">
          <div className="garden-moon" />
          <span className="garden-comet garden-comet-one" />
          <span className="garden-comet garden-comet-two" />
          {STAR_POSITIONS.map(([left, top], index) => (
            <span
              key={`${left}-${top}`}
              className="garden-star"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${index * 180}ms`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 px-5 pb-8 pt-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Hana's quests"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-sm backdrop-blur outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-right text-xs text-white/80 backdrop-blur">
              Arc {springArc.arcNumber} · {springArc.percent}% full
            </div>
          </div>

          <header className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
              {springArc.season} night garden
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {springArc.isComplete
                ? 'Spring is in full bloom.'
                : 'The garden blooms quietly.'}
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-white/68">
              {springArc.isComplete
                ? 'Arc 1 is complete. The next season will ask for consistency and tougher choices.'
                : "Each flower is planted from Hana's completed quests. Evening weeds may wilt a few, but the garden keeps growing."}
            </p>
          </header>

          <section
            className={`garden-stage ${springArc.isComplete ? 'garden-stage-complete' : ''}`}
            aria-label="Hana's planted garden"
          >
            <div className="garden-horizon" aria-hidden="true" />
            <div className="garden-hill garden-hill-back" aria-hidden="true" />
            <div className="garden-hill garden-hill-front" aria-hidden="true" />
            <CoupleSilhouette />
            {springArc.isComplete ? (
              <div className="spring-complete-glow" aria-hidden="true">
                <span>♪</span>
                <span>♬</span>
                <span>✦</span>
              </div>
            ) : null}

            {flowers.length === 0 ? (
              <p className="garden-empty">
                Complete a quest and the first flower will open here.
              </p>
            ) : (
              flowers.map((_, index) => (
                <PlantedFlower key={index} index={index} total={flowers.length} />
              ))
            )}
          </section>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-card border border-white/12 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Spring fullness
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {springArc.percent}%
              </p>
            </div>
            <div className="rounded-card border border-white/12 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Net flowers
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {game.totalFlowers}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-card border border-white/12 bg-white/10 p-4 text-sm leading-6 text-white/68 backdrop-blur">
            Level {levelProgress.level} · {weedProgress.wiltedFlowers} wilted ·{' '}
            {springArc.isComplete
              ? `${springArc.nextSeason} season is waiting.`
              : `${springArc.flowersRemaining} flowers until Spring is full.`}
          </div>
        </div>
      </div>
    </div>
  )
}

function CoupleSilhouette() {
  return (
    <svg
      viewBox="0 0 180 120"
      className="garden-couple"
      aria-label="A couple sitting together and watching the stars"
      role="img"
    >
      <ellipse cx="92" cy="108" rx="70" ry="9" fill="rgba(0,0,0,0.28)" />
      <path
        d="M34 96 C44 80 54 72 68 74 C79 76 84 86 82 101 L30 101 C30 99 32 97 34 96Z"
        fill="#101321"
      />
      <path
        d="M99 101 C96 86 102 76 114 74 C130 72 141 82 151 101 L99 101Z"
        fill="#101321"
      />
      <circle cx="65" cy="58" r="16" fill="#101321" />
      <circle cx="116" cy="58" r="16" fill="#101321" />
      <path
        d="M78 82 C86 76 96 76 104 82"
        fill="none"
        stroke="#101321"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M54 100 C66 106 78 106 91 100"
        fill="none"
        stroke="#101321"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M92 100 C106 107 124 106 139 100"
        fill="none"
        stroke="#101321"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M82 74 C87 81 94 81 99 74"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlantedFlower({ index, total }: { index: number; total: number }) {
  const color = FLOWER_COLORS[index % FLOWER_COLORS.length]
  const row = Math.floor(index / 8)
  const col = index % 8
  const left = 9 + col * 11 + ((row % 2) * 5)
  const bottom = 11 + row * 8
  const scale = 0.72 + ((index * 17) % 32) / 100
  const rotate = ((index * 13) % 18) - 9
  const cappedBottom = Math.min(bottom, 58)

  return (
    <svg
      viewBox="0 0 60 96"
      className="planted-flower"
      style={{
        left: `${Math.min(left, 88)}%`,
        bottom: `${cappedBottom}%`,
        transform: `translateX(-50%) scale(${scale}) rotate(${rotate}deg)`,
        animationDelay: `${Math.min(index, total) * 70}ms`,
      }}
      aria-hidden="true"
    >
      <path
        d="M30 88 C30 66 30 49 30 30"
        fill="none"
        stroke="#7cb36f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M30 62 C18 54 13 48 12 39 C23 39 29 47 30 62Z"
        fill="#6ea765"
        opacity="0.9"
      />
      <path
        d="M31 71 C43 63 48 56 49 47 C38 47 32 56 31 71Z"
        fill="#7fbd75"
        opacity="0.85"
      />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="30"
          cy="24"
          rx="9"
          ry="16"
          fill={color[0]}
          transform={`rotate(${deg} 30 32)`}
        />
      ))}
      <circle cx="30" cy="32" r="7" fill={color[1]} />
      <ellipse cx="30" cy="91" rx="16" ry="4" fill="rgba(0,0,0,0.13)" />
    </svg>
  )
}
