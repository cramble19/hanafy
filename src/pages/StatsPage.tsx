import { ChevronLeft, Leaf } from 'lucide-react'
import type { CSSProperties } from 'react'
import { quests } from '@/data/quests'
import hanaWeeds from '@/data/hanaWeeds.json'
import { getHanaStats, type DailyStat } from '@/lib/hanaStats'
import type { GardenWeed, HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenQuests: () => void
  onOpenWeeds: () => void
}

const weedLabels = new Map(
  (hanaWeeds as GardenWeed[]).map((weed) => [weed.id, weed.title]),
)

const DAY_FLOWER_COLORS = [
  '#f6d8a8',
  '#f7c4b4',
  '#efb63f',
  '#d8c4e8',
  '#f1d9a2',
  '#f1bd8d',
  '#d6b7c8',
] as const

export function StatsPage({ game, onBack, onOpenQuests, onOpenWeeds }: Props) {
  const stats = getHanaStats(game, quests)
  const bestDay = getBestDay(stats.currentWeek.days)
  const needsSofterDay = getNeedsSofterDay(stats.currentWeek.days)

  return (
    <div className="stats-page-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
      <BotanicalCorner />
      <div className="mb-7 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Hana's quests"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/88 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
          Garden stats
        </span>
      </div>

      <header className="stats-title-card mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
          Hana's week
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">
          This week in bloom
        </h1>
        <p className="mt-2 text-sm text-muted">
          {formatWeekRange(stats.currentWeek.days)}
        </p>
      </header>

      <section
        className="stats-week-scroll -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1"
        aria-label="This week completion cards"
      >
        {stats.currentWeek.days.map((day, index) => (
          <WeekBloomCard
            key={day.dateKey}
            day={day}
            color={DAY_FLOWER_COLORS[index % DAY_FLOWER_COLORS.length]}
          />
        ))}
      </section>

      <section className="stats-insight-card mb-5 rounded-card border border-border bg-surface/86 p-5 shadow-sm backdrop-blur">
        <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <span aria-hidden="true">✽</span>
              This week's insight
            </p>
            <div className="mt-6 space-y-5">
              <InsightLine
                label="Best bloom:"
                value={bestDay ? formatWeekday(bestDay.dateKey) : 'Waiting'}
              />
              <InsightLine
                label="Needs softer plan:"
                value={
                  needsSofterDay
                    ? formatWeekday(needsSofterDay.dateKey)
                    : 'Nothing yet'
                }
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-medium text-muted">
              Daily completion
            </p>
            <FlowerStemChart days={stats.currentWeek.days} />
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <AllQuestsCard onOpenAll={onOpenQuests} />
        <WeedListCard weeds={stats.weedStats} onOpenAll={onOpenWeeds} />
      </div>

      <p className="stats-footer-note text-center text-sm leading-6 text-muted">
        <span aria-hidden="true">♡</span> Small steps. Soft roots. Beautiful
        becoming.
      </p>
    </div>
  )
}

function WeekBloomCard({
  day,
  color,
}: {
  day: DailyStat
  color: string
}) {
  const percent = day.shown === 0 ? 0 : day.completionRate

  return (
    <div
      className={`stats-day-card ${percent >= 80 ? 'stats-day-card-best' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {formatWeekday(day.dateKey).slice(0, 3)}
      </p>
      <SmallFlower color={color} muted={day.shown === 0} />
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
        {day.shown === 0 ? '-' : `${percent}%`}
      </p>
      <div className="mt-2 space-y-1 text-[11px] text-muted">
        <p className="flex items-center justify-center gap-1">
          <span aria-hidden="true">✓</span>
          {day.completed}
        </p>
        <p className="flex items-center justify-center gap-1">
          <span aria-hidden="true">♧</span>
          {day.skipped + day.missed}
        </p>
      </div>
    </div>
  )
}

function FlowerStemChart({ days }: { days: DailyStat[] }) {
  return (
    <div className="stats-stem-chart">
      {[100, 75, 50, 25, 0].map((mark) => (
        <span key={mark} className="stats-chart-line" style={{ bottom: `${mark}%` }}>
          {mark}%
        </span>
      ))}
      <div className="stats-stem-bars">
        {days.map((day, index) => {
          const height = Math.max(18, day.completionRate)
          return (
            <div key={day.dateKey} className="stats-stem-column">
              <span
                className="stats-stem"
                style={{
                  height: `${height}%`,
                  '--bar-color': DAY_FLOWER_COLORS[index % DAY_FLOWER_COLORS.length],
                } as CSSProperties}
                aria-label={`${formatWeekday(day.dateKey)} ${day.completionRate}%`}
              />
              <span className="stats-stem-label">
                {formatWeekday(day.dateKey).slice(0, 1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AllQuestsCard({ onOpenAll }: { onOpenAll: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenAll}
      className="stats-moon-card rounded-card border border-border bg-surface/84 p-4 text-left shadow-sm backdrop-blur transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="flex items-center gap-2 text-lg font-semibold leading-6 text-ink">
            <Leaf className="size-4 text-success" />
            All quests
          </span>
          <span className="mt-2 block text-xs leading-5 text-muted">
            Open every quest and its calendar trail.
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-muted">View all</span>
      </span>
    </button>
  )
}

function WeedListCard({
  weeds,
  onOpenAll,
}: {
  weeds: Array<{ weedId: string; checked: number }>
  onOpenAll: () => void
}) {
  return (
    <section className="stats-moon-card rounded-card border border-border bg-surface/84 p-4 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={onOpenAll}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Leaf className="size-4 text-success" />
          Evening weeds
        </span>
        <span className="text-xs font-medium text-muted">View all</span>
      </button>
      <div className="mt-3 space-y-2">
        {weeds.length > 0 ? (
          weeds.slice(0, 3).map((weed) => (
            <MiniInsightRow
              key={weed.weedId}
              icon="◐"
              label={weedLabels.get(weed.weedId) ?? weed.weedId}
              value={`${weed.checked}x`}
              color="#8fb48a"
            />
          ))
        ) : (
          <p className="rounded-control bg-surface-2 px-3 py-2 text-xs leading-5 text-muted">
            No Evening Weeds checked yet.
          </p>
        )}
      </div>
    </section>
  )
}

function MiniInsightRow({
  icon,
  label,
  value,
  color,
}: {
  icon: string
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-full border border-border bg-white/52 px-2.5 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ backgroundColor: `${color}24` }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-ink">{label}</span>
      </span>
      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">
        {value}
      </span>
    </div>
  )
}

function InsightLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-7 tracking-tight text-ink">
        {value}
      </p>
    </div>
  )
}

function SmallFlower({ color, muted = false }: { color: string; muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 42 42"
      className={`mx-auto mt-3 size-11 ${muted ? 'opacity-30 grayscale' : ''}`}
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="21"
          cy="13"
          rx="5"
          ry="10"
          fill={color}
          opacity="0.72"
          transform={`rotate(${deg} 21 21)`}
        />
      ))}
      <circle cx="21" cy="21" r="5" fill="#f4cf73" />
    </svg>
  )
}

function BotanicalCorner() {
  return (
    <div className="stats-botanical-corner" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

function getBestDay(days: DailyStat[]) {
  return days
    .filter((day) => day.shown > 0)
    .sort(
      (first, second) =>
        second.completionRate - first.completionRate ||
        second.completed - first.completed,
    )[0]
}

function getNeedsSofterDay(days: DailyStat[]) {
  return days
    .filter((day) => day.shown > 0 && day.skipped + day.missed > 0)
    .sort(
      (first, second) =>
        second.skipped + second.missed - (first.skipped + first.missed) ||
        first.completionRate - second.completionRate,
    )[0]
}

function formatWeekRange(days: DailyStat[]) {
  const visibleDays = days.filter((day) => day.dateKey)
  const first = visibleDays[0]?.dateKey
  const last = visibleDays.at(-1)?.dateKey
  if (!first || !last) {
    return 'A gentle look at the week'
  }

  return `${formatShortDate(first)} - ${formatShortDate(last)}`
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatWeekday(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
  })
}
