import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { quests } from '@/data/quests'
import hanaWeeds from '@/data/hanaWeeds.json'
import springQuotes from '@/data/springQuotes.json'
import { EveningWeeds } from '@/components/EveningWeeds'
import { QuestSection } from '@/components/QuestSection'
import { FlowerMark } from '@/components/icons/FlowerMark'
import {
  displayDate,
  getLongTermCheckedIds,
  getLongTermQuestStatus,
  getLevelProgress,
  getSkippedIdsForState,
  getSkipProgress,
  getSpringArcProgress,
  getWeedProgress,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import type { GardenWeed, HanaGameState } from '@/types'

const eveningWeeds = hanaWeeds as GardenWeed[]
const seasonalQuotes = springQuotes as SeasonQuote[]
const PETAL_POSITIONS = [
  [8, 0.2, 8.5],
  [20, 2.6, 10.5],
  [34, 1.1, 9.4],
  [49, 3.2, 11.2],
  [63, 0.8, 8.9],
  [78, 2.1, 10.8],
  [91, 1.7, 9.8],
] as const

type SeasonQuote = {
  id: string
  kind: 'spring' | 'april-inspired' | 'anime-quote'
  text: string
  source: string
}

type Props = {
  game: HanaGameState
  onToggle: (id: string) => void
  onSkip: (id: string) => void
  onToggleWeed: (id: string) => void
  onOpenGarden: () => void
  onOpenStats: () => void
  onNextDay: () => void
  onReset: () => void
  onSyncCloud: () => void
  cloudSyncStatus:
    | 'idle'
    | 'loading'
    | 'syncing'
    | 'synced'
    | 'error'
    | 'offline'
    | 'disabled'
    | 'preview'
  lastCloudSyncAt: string | null
  onBack: () => void
}

export function HanaPage({
  game,
  onToggle,
  onSkip,
  onToggleWeed,
  onOpenGarden,
  onOpenStats,
  onNextDay,
  onReset,
  onSyncCloud,
  cloudSyncStatus,
  lastCloudSyncAt,
  onBack,
}: Props) {
  const levelProgress = getLevelProgress(game.totalFlowers)
  const visibleQuests = visibleQuestsForState(quests, game)
  const dailyCheckedIds = game.dailyCompletions[game.currentDate] ?? {}
  const skippedIds = getSkippedIdsForState(quests, game)
  const skipProgress = getSkipProgress(game)
  const weedCheckedIds = game.eveningWeeds?.[game.currentDate] ?? {}
  const weedProgress = getWeedProgress(game)
  const longTermCheckedIds = getLongTermCheckedIds(game)
  const springArc = getSpringArcProgress(game)
  const seasonalQuote = getSeasonalQuote(game.currentDate)
  const showDevControls = import.meta.env.DEV
  const longTermMetaById = Object.fromEntries(
    visibleQuests.longTerm.map((quest) => [
      quest.id,
      getLongTermQuestStatus(game, quest).label,
    ]),
  )

  const resetWithConfirmation = () => {
    if (window.confirm("Reset Hana's flowers and checked quests?")) {
      onReset()
    }
  }

  return (
    <div className="hana-spring-shell mx-auto min-h-full w-full max-w-md px-5 pb-40 pt-6">
      <SpringDecor />
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <FlowerMark className="size-4" />
          Hana
        </span>
      </div>

      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
          Arc {springArc.arcNumber} · {springArc.season} season
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {springArc.isComplete ? 'Spring Complete' : 'Today'}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="size-4" />
              {displayDate(game.currentDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncCloud}
            disabled={
              cloudSyncStatus === 'loading' ||
              cloudSyncStatus === 'syncing' ||
              cloudSyncStatus === 'disabled' ||
              cloudSyncStatus === 'preview'
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm outline-none transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
            aria-label="Refresh Hana's progress from database"
          >
            <RefreshCw
              className={`size-3.5 ${cloudSyncStatus === 'loading' || cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
        <p className="mt-3 text-xs text-faint">{getCloudSyncLabel(cloudSyncStatus, lastCloudSyncAt)}</p>
      </header>

      <section className="spring-quote-card mb-5 rounded-card border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
            {getQuoteLabel(seasonalQuote)}
          </p>
          <span className="text-sm" aria-hidden="true">
            {getQuoteIcon(seasonalQuote)}
          </span>
        </div>
        <blockquote className="mt-2 text-sm leading-6 text-ink">
          "{seasonalQuote.text}"
        </blockquote>
        <p className="mt-2 text-xs font-medium text-muted">
          {seasonalQuote.source}
        </p>
      </section>

      <section className="mb-8 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Flower balance</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">
              {game.totalFlowers} 🌸
            </p>
          </div>
          <FlowerMark className="size-14 flower-pulse" />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs font-medium text-muted">
            <span>Level {levelProgress.level}</span>
            <span>
              {levelProgress.collectedThisLevel}/{levelProgress.neededThisLevel}{' '}
              flowers
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${levelProgress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-faint">
            New gentle quests unlock as Hana collects flowers.
          </p>
        </div>

        <MiniGardenPreview
          totalFlowers={game.totalFlowers}
          springPercent={springArc.percent}
          onOpenGarden={onOpenGarden}
        />
      </section>

      <main className="space-y-8">
        <QuestSection
          title="Daily Quests"
          quests={visibleQuests.daily}
          checkedIds={dailyCheckedIds}
          skippedIds={skippedIds}
          canSkip={skipProgress.remaining > 0}
          onToggle={onToggle}
          onSkip={onSkip}
        />
        <QuestSection
          title="Long Term Quests"
          quests={visibleQuests.longTerm}
          checkedIds={longTermCheckedIds}
          skippedIds={skippedIds}
          canSkip={skipProgress.remaining > 0}
          metaById={longTermMetaById}
          onToggle={onToggle}
          onSkip={onSkip}
        />
        <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted shadow-sm">
          <span className="font-medium text-ink">Weekly skips:</span>{' '}
          {skipProgress.remaining}/{skipProgress.limit} left
          <p className="mt-1 text-xs text-faint">
            Skips reset every Sunday. A skipped quest gives 0 flowers.
          </p>
        </div>
        <EveningWeeds
          weeds={eveningWeeds}
          checkedIds={weedCheckedIds}
          weedsTowardNextWilt={weedProgress.weedsTowardNextWilt}
          weedsPerWiltedFlower={weedProgress.weedsPerWiltedFlower}
          wiltedFlowers={weedProgress.wiltedFlowers}
          onToggle={onToggleWeed}
        />
      </main>

      <section className="spring-arc-card mt-10 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">
              Arc {springArc.arcNumber}: {springArc.season}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
              {springArc.isComplete ? 'First bloom unlocked' : 'Make spring bloom'}
            </h2>
          </div>
          <div className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
            {springArc.percent}%
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/65">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${springArc.percent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-control bg-white/60 p-3">
            <p className="text-xs font-medium text-faint">Spring level</p>
            <p className="mt-1 font-semibold text-ink">
              Level {Math.min(levelProgress.level, springArc.targetLevel)}/
              {springArc.targetLevel}
            </p>
          </div>
          <div className="rounded-control bg-white/60 p-3">
            <p className="text-xs font-medium text-faint">Garden fullness</p>
            <p className="mt-1 font-semibold text-ink">
              {Math.min(game.totalFlowers, springArc.targetFlowers)}/
              {springArc.targetFlowers} flowers
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">
          {springArc.isComplete
            ? `Spring is fully bloomed. ${springArc.nextSeason} will bring ${springArc.nextTheme.toLowerCase()}.`
            : springArc.flowersRemaining > 0
              ? `${springArc.flowersRemaining} more flowers to finish this gentle first season.`
              : 'Reach the Spring level target to close Arc 1.'}
        </p>
      </section>

      {showDevControls ? (
        <section className="mt-10 rounded-card border border-dashed border-border bg-surface/70 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
            Dev testing
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onNextDay}
              className="rounded-control bg-ink px-4 py-3 text-sm font-medium text-canvas shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Next day
            </button>
            <button
              type="button"
              onClick={resetWithConfirmation}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-3 text-sm font-medium text-muted shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            >
              <RotateCcw className="size-4" />
              Reset
            </button>
          </div>
        </section>
      ) : null}

      <div className="sticky-garden-bar">
        <button
          type="button"
          onClick={onOpenGarden}
          className="sticky-garden-button"
          aria-label="Open Hana's night garden"
        >
          <span className="sticky-garden-moon" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Open night garden
            </span>
            <span className="block text-xs text-muted">
              {game.totalFlowers} flowers planted · {skipProgress.remaining} skips left
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenStats}
          className="sticky-garden-button sticky-stats-button"
          aria-label="Open Hana's stats"
        >
          <span className="sticky-stats-icon" aria-hidden="true">
            <BarChart3 className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">
              View garden stats
            </span>
            <span className="block text-xs text-muted">
              See blooms, skips, and soft patterns
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

function MiniGardenPreview({
  totalFlowers,
  springPercent,
  onOpenGarden,
}: {
  totalFlowers: number
  springPercent: number
  onOpenGarden: () => void
}) {
  const bloomCount = Math.min(5, Math.max(1, Math.ceil(springPercent / 20)))

  return (
    <button
      type="button"
      onClick={onOpenGarden}
      className="mini-garden-card mt-5 w-full text-left transition active:scale-[0.98] motion-reduce:transition-none"
      aria-label="Open Hana's night garden"
    >
      <span className="mini-garden-sky" aria-hidden="true">
        <span className="mini-garden-moon" />
        {Array.from({ length: bloomCount }, (_, index) => (
          <MiniBloom key={index} index={index} />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">
          Night garden preview
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">
          {totalFlowers === 0
            ? 'Plant the first flower today.'
            : `${totalFlowers} net flowers are blooming under the moon.`}
        </span>
      </span>
    </button>
  )
}

function MiniBloom({ index }: { index: number }) {
  const left = 18 + index * 13
  const colors = ['#f7a6be', '#d98ba0', '#f1b56f', '#9e8fd0', '#8fb48a']

  return (
    <svg
      viewBox="0 0 24 34"
      className="mini-garden-flower"
      style={{ left: `${left}%`, animationDelay: `${index * 120}ms` }}
      aria-hidden="true"
    >
      <path
        d="M12 31 C12 23 12 17 12 11"
        fill="none"
        stroke="#78ab63"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="12"
          cy="9"
          rx="3.5"
          ry="6"
          fill={colors[index % colors.length]}
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.8" fill="#eea63a" />
    </svg>
  )
}

function SpringDecor() {
  return (
    <div className="spring-decor-layer" aria-hidden="true">
      <div className="spring-petals">
        {PETAL_POSITIONS.map(([left, delay, duration]) => (
          <span
            key={`${left}-${delay}`}
            className="spring-petal"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function getSeasonalQuote(dateKey: string) {
  const index =
    dateKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    seasonalQuotes.length

  return seasonalQuotes[index]
}

function getQuoteLabel(quote: SeasonQuote) {
  if (quote.kind === 'spring') {
    return 'Spring quote'
  }
  if (quote.kind === 'anime-quote') {
    return 'Your Lie in April quote'
  }
  return 'April-inspired note'
}

function getQuoteIcon(quote: SeasonQuote) {
  if (quote.kind === 'spring') {
    return '🌷'
  }
  if (quote.kind === 'anime-quote') {
    return '🎼'
  }
  return '🎻'
}

function getCloudSyncLabel(
  status: Props['cloudSyncStatus'],
  lastCloudSyncAt: string | null,
) {
  if (status === 'disabled') {
    return 'Local development uses the saved cache.'
  }
  if (status === 'preview') {
    return 'Preview only. Pick Hana\'s start date before saving to the database.'
  }
  if (status === 'loading') {
    return 'Loading the latest garden from the database...'
  }
  if (status === 'syncing') {
    return "Saving Hana's latest change to the database..."
  }
  if (status === 'error') {
    return 'Database refresh failed. Showing the saved cache for now.'
  }
  if (status === 'offline') {
    return 'Offline. Showing the saved cache until database returns.'
  }
  if (status === 'synced' && lastCloudSyncAt) {
    return `Database garden loaded ${formatSyncTime(lastCloudSyncAt)}.`
  }
  return 'Database is the source of truth. Local cache is only a fallback.'
}

function formatSyncTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'recently'
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
