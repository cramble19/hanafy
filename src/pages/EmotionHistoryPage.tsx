import { CalendarDays, ChevronLeft, CircleHelp } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { EmotionFaceIcon } from '@/components/icons/EmotionFaceIcon'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import {
  EMOTIONS_BEST_FIRST,
  getEmotionHistoryStats,
  getEmotionTimelineRuns,
  type EmotionHistoryRange,
} from '@/lib/emotionHistory'
import { DAILY_EMOTION_LABELS } from '@/lib/dailyEmotions'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import type { DailyEmotion, HanaGameState } from '@/types'

type Props = {
  game: HanaGameState
  profileId: HanaProfileId
  onBack: () => void
}

const RANGE_OPTIONS: Array<{
  value: EmotionHistoryRange
  label: string
  name: string
}> = [
  { value: 7, label: '7D', name: 'Past 7 days' },
  { value: 30, label: '30D', name: 'Past 30 days' },
  { value: 90, label: '90D', name: 'Past 90 days' },
]

const CHART = {
  width: 360,
  height: 270,
  left: 70,
  right: 346,
  top: 18,
  bottom: 218,
} as const

export function EmotionHistoryPage({ game, profileId, onBack }: Props) {
  const isCramble = profileId === 'cramble'
  const headingRef = usePageHeadingFocus()
  const [range, setRange] = useState<EmotionHistoryRange>(30)
  const resultsId = useId()
  const stats = useMemo(
    () => getEmotionHistoryStats(game, range),
    [game, range],
  )
  const runs = getEmotionTimelineRuns(stats.days)
  const indexByDate = new Map(
    stats.days.map((day, index) => [day.dateKey, index]),
  )
  const tickIndices = getDateTickIndices(stats.days.length)
  const chartSummary = getChartSummary(stats.days, stats.recordedDays)

  return (
    <div
      className={`${isCramble ? 'cramble-archive-shell' : 'stats-page-shell hana-ledger-shell'} emotion-history-shell mx-auto min-h-full w-full max-w-md px-5 pb-12 pt-6`}
      data-profile={profileId}
    >
      {isCramble ? (
        <div className="cramble-decor-layer" aria-hidden="true" />
      ) : null}

      <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the Ledger"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted">
          Daily record
        </span>
      </div>

      <main className="relative z-10">
        <header className="emotion-history-heading text-center">
          <EmotionFaceIcon
            emotion={stats.current ?? stats.mostCommon ?? 'okay'}
            profile={profileId}
            className="emotion-history-heading-icon mx-auto"
          />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-3xl font-semibold tracking-tight text-ink outline-none"
          >
            Emotion history
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isCramble
              ? 'A field record, never a judgment.'
              : 'A gentle record, never a score.'}
          </p>
        </header>

        <div
          className="emotion-history-range mt-6"
          aria-label="Emotion history range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={range === option.value}
              aria-controls={resultsId}
              data-selected={range === option.value}
              onClick={() => setRange(option.value)}
            >
              <span aria-hidden="true">{option.label}</span>
              <span className="sr-only">{option.name}</span>
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Showing the past {range} days. {stats.recordedDays}{' '}
          {stats.recordedDays === 1 ? 'day' : 'days'} recorded.
        </p>

        <section
          id={resultsId}
          className="habit-ledger-card emotion-history-chart-card mt-4 rounded-card border border-border bg-surface px-2 pb-4 pt-5 shadow-sm"
          aria-labelledby={`${resultsId}-heading`}
        >
          <h2 id={`${resultsId}-heading`} className="sr-only">
            Emotion timeline for the selected range
          </h2>
          <svg
            className="emotion-history-chart"
            viewBox={`0 0 ${CHART.width} ${CHART.height}`}
            role="img"
            aria-label={chartSummary}
          >
            {EMOTIONS_BEST_FIRST.map((emotion) => {
              const y = emotionY(emotion)
              return (
                <g key={emotion}>
                  <line
                    x1={CHART.left}
                    x2={CHART.right}
                    y1={y}
                    y2={y}
                    className="emotion-chart-grid-line"
                  />
                  <text
                    x={CHART.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="emotion-chart-axis-label"
                  >
                    {DAILY_EMOTION_LABELS[emotion]}
                  </text>
                </g>
              )
            })}

            {runs.map((run) => {
              if (run.length < 2) return null
              const points = run
                .map((day) => {
                  const index = indexByDate.get(day.dateKey) ?? 0
                  return `${dayX(index, stats.days.length)},${emotionY(day.emotion)}`
                })
                .join(' ')
              return (
                <polyline
                  key={run[0].dateKey}
                  points={points}
                  className="emotion-chart-line"
                />
              )
            })}

            {stats.days.map((day, index) =>
              day.emotion ? (
                <EmotionChartPoint
                  key={day.dateKey}
                  x={dayX(index, stats.days.length)}
                  y={emotionY(day.emotion)}
                  profileId={profileId}
                  dateKey={day.dateKey}
                  emotion={day.emotion}
                />
              ) : null,
            )}

            {tickIndices.map((index) => {
              const day = stats.days[index]
              if (!day) return null
              const x = dayX(index, stats.days.length)
              return (
                <g key={day.dateKey}>
                  <line
                    x1={x}
                    x2={x}
                    y1={CHART.bottom + 3}
                    y2={CHART.bottom + 9}
                    className="emotion-chart-tick"
                  />
                  <text
                    x={x}
                    y={CHART.bottom + 25}
                    textAnchor={index === 0 ? 'start' : index === stats.days.length - 1 ? 'end' : 'middle'}
                    className="emotion-chart-date-label"
                  >
                    {formatChartDate(day.dateKey)}
                  </text>
                </g>
              )
            })}
          </svg>

          {stats.recordedDays === 0 ? (
            <p className="emotion-history-empty">
              No emotions recorded in this range. Empty days stay neutral.
            </p>
          ) : (
            <p className="mt-1 text-center text-[11px] leading-5 text-muted">
              Blank dates are neutral gaps.
            </p>
          )}

          <ol className="sr-only">
            {stats.days
              .filter((day) => day.emotion)
              .map((day) => (
                <li key={day.dateKey}>
                  {formatAccessibleDate(day.dateKey)}: {DAILY_EMOTION_LABELS[day.emotion!]}
                </li>
              ))}
          </ol>
        </section>

        <section className="emotion-history-metrics mt-4" aria-label="Emotion summary">
          <EmotionMetric
            icon={
              stats.mostCommon ? (
                <EmotionFaceIcon
                  emotion={stats.mostCommon}
                  profile={profileId}
                  className="emotion-history-metric-icon"
                />
              ) : (
                <CircleHelp className="size-5" aria-hidden="true" />
              )
            }
            label="Most common"
            value={emotionLabel(stats.mostCommon)}
          />
          <EmotionMetric
            icon={<CalendarDays className="size-5" aria-hidden="true" />}
            label="Days recorded"
            value={String(stats.recordedDays)}
          />
          <EmotionMetric
            icon={
              stats.current ? (
                <EmotionFaceIcon
                  emotion={stats.current}
                  profile={profileId}
                  className="emotion-history-metric-icon"
                />
              ) : (
                <CircleHelp className="size-5" aria-hidden="true" />
              )
            }
            label="Current"
            value={emotionLabel(stats.current)}
          />
        </section>
      </main>
    </div>
  )
}

function EmotionChartPoint({
  x,
  y,
  profileId,
  dateKey,
  emotion,
}: {
  x: number
  y: number
  profileId: HanaProfileId
  dateKey: string
  emotion: DailyEmotion
}) {
  return (
    <g className="emotion-chart-point" data-profile={profileId}>
      <title>{`${formatAccessibleDate(dateKey)}: ${DAILY_EMOTION_LABELS[emotion]}`}</title>
      {profileId === 'hana' ? (
        <>
          <circle cx={x} cy={y} r="6" className="emotion-chart-point-halo" />
          <circle cx={x} cy={y} r="3.3" className="emotion-chart-point-core" />
          <circle cx={x} cy={y} r="1.15" className="emotion-chart-point-center" />
        </>
      ) : (
        <>
          <circle cx={x} cy={y} r="5.2" className="emotion-chart-point-rune" />
          <path d={`M ${x - 7.5} ${y} H ${x + 7.5} M ${x} ${y - 7.5} V ${y + 7.5}`} className="emotion-chart-point-rays" />
          <circle cx={x} cy={y} r="1.35" className="emotion-chart-point-center" />
        </>
      )}
    </g>
  )
}

function EmotionMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="habit-ledger-card emotion-history-metric rounded-card border border-border bg-surface p-3 text-center shadow-sm">
      <span className="emotion-history-metric-symbol mx-auto" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-2 text-xs font-semibold text-ink">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--emotion-accent)]">
        {value}
      </p>
    </div>
  )
}

function dayX(index: number, dayCount: number) {
  if (dayCount <= 1) return (CHART.left + CHART.right) / 2
  return CHART.left + (index / (dayCount - 1)) * (CHART.right - CHART.left)
}

function emotionY(emotion: DailyEmotion) {
  const index = EMOTIONS_BEST_FIRST.indexOf(emotion)
  return CHART.top + (index / (EMOTIONS_BEST_FIRST.length - 1)) * (CHART.bottom - CHART.top)
}

function getDateTickIndices(dayCount: number) {
  if (dayCount <= 1) return dayCount ? [0] : []
  const tickCount = Math.min(5, dayCount)
  return [...new Set(
    Array.from({ length: tickCount }, (_, index) =>
      Math.round((index / (tickCount - 1)) * (dayCount - 1)),
    ),
  )]
}

function emotionLabel(emotion: DailyEmotion | null) {
  return emotion ? DAILY_EMOTION_LABELS[emotion] : 'Not set'
}

function formatChartDate(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatAccessibleDate(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function getChartSummary(
  days: Array<{ dateKey: string; emotion: DailyEmotion | null }>,
  recordedDays: number,
) {
  if (!days.length || !recordedDays) {
    return 'Emotion history chart. No emotions were recorded in this range.'
  }
  const first = days[0]
  const last = days.at(-1)!
  return `Emotion history from ${formatAccessibleDate(first.dateKey)} through ${formatAccessibleDate(last.dateKey)}. ${recordedDays} ${recordedDays === 1 ? 'day' : 'days'} recorded. Bright is at the top and Heavy is at the bottom; blank dates are neutral gaps.`
}
