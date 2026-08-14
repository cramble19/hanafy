import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, Leaf } from 'lucide-react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { SunMark } from '@/components/icons/SunMark'
import { TogetherMark } from '@/components/icons/TogetherMark'
import { crambleQuests } from '@/data/crambleQuests'
import { quests } from '@/data/quests'
import {
  getCombinedStats,
  type CombinedStatsResult,
  type ComparisonRange,
  type ComparisonTrendBucket,
  type ProfileComparisonSummary,
} from '@/lib/combinedStats'
import { DAILY_EMOTION_LABELS } from '@/lib/dailyEmotions'
import {
  EMOTIONS_BEST_FIRST,
  getCombinedEmotionStats,
  getEmotionTimelineRuns,
  type CombinedEmotionRange,
  type CombinedEmotionStats,
} from '@/lib/emotionHistory'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { DailyEmotion, HanaGameState } from '@/types'

type Props = {
  hanaGame: HanaGameState
  crambleGame: HanaGameState
  notice?: string | null
  onBack: () => void
}

const RANGE_OPTIONS: ComparisonRange[] = [7, 30, 90]
const EMOTION_RANGE_OPTIONS: CombinedEmotionRange[] = [7, 30]

export function TogetherPage({
  hanaGame,
  crambleGame,
  notice = null,
  onBack,
}: Props) {
  const [range, setRange] = useState<ComparisonRange>(30)
  const [emotionRange, setEmotionRange] =
    useState<CombinedEmotionRange>(7)
  const headingRef = usePageHeadingFocus()
  const stats = useMemo(
    () =>
      getCombinedStats(
        hanaGame,
        quests,
        crambleGame,
        crambleQuests,
        range,
      ),
    [crambleGame, hanaGame, range],
  )
  const emotionStats = useMemo(
    () => getCombinedEmotionStats(hanaGame, crambleGame, emotionRange),
    [crambleGame, emotionRange, hanaGame],
  )

  return (
    <div className="together-shell mx-auto min-h-full w-full max-w-md px-5 pb-10 pt-6">
      <div className="together-decor-layer" aria-hidden="true" />

      <header className="relative z-10 text-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="together-back-button absolute left-0 top-0 grid size-11 place-items-center rounded-full border border-border bg-surface/90 text-ink outline-none"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <TogetherMark className="together-page-mark mx-auto" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-3xl font-semibold tracking-tight text-ink outline-none"
        >
          Shared Journey
        </h1>
        <p className="mt-1 text-sm text-muted">Two paths. One steady rhythm.</p>
      </header>

      <div
        className="together-range-control relative z-10 mt-6"
        role="group"
        aria-label="Comparison range"
      >
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={range === option}
            onClick={() => setRange(option)}
            className="together-range-button"
          >
            {option}D
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {range}-day comparison: Hana {stats.hana.activeDays} active
        days, Cramble {stats.cramble.activeDays} active days, and{' '}
        {stats.sharedActiveDays} shared active days.
      </p>

      {notice ? (
        <p className="together-notice relative z-10 mt-4" role="status">
          {notice}
        </p>
      ) : null}

      <main className="relative z-10 mt-5 space-y-5">
        <section className="together-hero-card" aria-labelledby="showing-up-title">
          <h2 id="showing-up-title" className="text-xl font-semibold text-ink">
            Showing up together
          </h2>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-ink">
            {stats.sharedActiveDays}{' '}
            <span className="text-2xl font-medium">
              {stats.sharedActiveDays === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            Both saved at least one quest or item action
          </p>
          <JourneyPaths />
        </section>

        <section aria-labelledby="settled-rhythm-title">
          <h2 id="settled-rhythm-title" className="together-section-title">
            Settled rhythm
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ProfileRhythmCard profile="hana" summary={stats.hana} />
            <ProfileRhythmCard profile="cramble" summary={stats.cramble} />
          </div>
          <p className="together-active-definition mt-2 text-center text-xs leading-5">
            Active days contain a saved, dated quest or item interaction.
          </p>
        </section>

        <ConsistencyTrend stats={stats} />

        <EmotionalWeather
          stats={emotionStats}
          range={emotionRange}
          onRangeChange={setEmotionRange}
        />

        <section aria-labelledby="strongest-rhythms-title">
          <h2 id="strongest-rhythms-title" className="together-section-title">
            Strongest rhythms
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StrongestRhythmCard profile="hana" summary={stats.hana} />
            <StrongestRhythmCard profile="cramble" summary={stats.cramble} />
          </div>
        </section>

        <p className="together-neutral-note">
          <Leaf className="size-4 shrink-0" aria-hidden="true" />
          Paused, skipped, archived, and still-open windows stay neutral.
        </p>

        <button
          type="button"
          onClick={onBack}
          className="together-home-button"
        >
          Back home
        </button>
      </main>
    </div>
  )
}

function EmotionalWeather({
  stats,
  range,
  onRangeChange,
}: {
  stats: CombinedEmotionStats
  range: CombinedEmotionRange
  onRangeChange: (range: CombinedEmotionRange) => void
}) {
  const chart = getEmotionChartGeometry(stats)
  const hanaRecorded = stats.days.filter(
    (day) => day.hanaEmotion !== null,
  ).length
  const crambleRecorded = stats.days.filter(
    (day) => day.crambleEmotion !== null,
  ).length
  const latestHanaIndex = getLatestRecordedEmotionIndex(stats, 'hana')
  const latestCrambleIndex = getLatestRecordedEmotionIndex(stats, 'cramble')
  const hasEvidence = hanaRecorded > 0 || crambleRecorded > 0
  const summary = `Emotion history from ${formatAccessibleDate(stats.startDate)} to ${formatAccessibleDate(stats.endDate)}. Hana recorded ${hanaRecorded} ${hanaRecorded === 1 ? 'day' : 'days'} and Cramble recorded ${crambleRecorded} ${crambleRecorded === 1 ? 'day' : 'days'}. The vertical scale runs from Bright to Heavy. Unrecorded days are neutral gaps.`

  return (
    <section
      className="together-emotion-card"
      aria-labelledby="emotional-weather-title"
    >
      <div className="together-emotion-heading">
        <div>
          <h2 id="emotional-weather-title" className="together-section-title">
            Emotional weather
          </h2>
          <p className="mt-1 text-xs text-muted">How both days have felt</p>
        </div>
        <div
          className="together-emotion-range"
          role="group"
          aria-label="Emotion chart range"
        >
          {EMOTION_RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-controls="together-emotion-chart"
              aria-pressed={range === option}
              onClick={() => onRangeChange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {range}-day emotion history. Hana recorded {hanaRecorded}{' '}
        {hanaRecorded === 1 ? 'day' : 'days'} and Cramble recorded{' '}
        {crambleRecorded} {crambleRecorded === 1 ? 'day' : 'days'}.
      </p>

      <div className="together-emotion-window" aria-hidden="true">
        <span>{formatAxisDate(stats.startDate)}–Today</span>
        <span>Every date stays visible</span>
      </div>

      <div className="relative mt-3">
        <svg
          id="together-emotion-chart"
          viewBox="0 0 360 224"
          className="w-full"
          role="img"
          aria-label={summary}
        >
          {range === 7
            ? stats.days.map((day, index) => {
                const x = chart.xFor(index)
                return (
                  <line
                    key={`emotion-guide-${day.dateKey}`}
                    x1={x}
                    x2={x}
                    y1="26"
                    y2="178"
                    className="together-emotion-day-guide"
                  />
                )
              })
            : null}

          {EMOTIONS_BEST_FIRST.map((emotion) => {
            const y = chart.yFor(emotion)
            return (
              <g key={emotion}>
                <line
                  x1="62"
                  x2="346"
                  y1={y}
                  y2={y}
                  className="together-chart-grid together-emotion-grid"
                />
                <text
                  x="54"
                  y={y + 4}
                  textAnchor="end"
                  className="together-chart-axis together-emotion-axis"
                >
                  {DAILY_EMOTION_LABELS[emotion]}
                </text>
              </g>
            )
          })}

          {chart.hanaSegments.map((segment, index) => (
            <polyline
              key={`emotion-hana-${index}`}
              points={segment}
              className="together-chart-line together-chart-line-hana"
            />
          ))}
          {chart.crambleSegments.map((segment, index) => (
            <polyline
              key={`emotion-cramble-${index}`}
              points={segment}
              className="together-chart-line together-chart-line-cramble"
            />
          ))}

          {stats.days.map((day, index) => {
            const x = chart.xFor(index)
            const sharesEmotion =
              day.hanaEmotion !== null &&
              day.hanaEmotion === day.crambleEmotion
            const markerOffset = sharesEmotion ? 3.5 : 0
            return (
              <g key={day.dateKey}>
                {day.crambleEmotion ? (
                  <EmotionChartMarker
                    profile="cramble"
                    x={x + markerOffset}
                    y={chart.yFor(day.crambleEmotion)}
                    useProfileMark={range === 7 || index === latestCrambleIndex}
                  />
                ) : null}
                {day.hanaEmotion ? (
                  <EmotionChartMarker
                    profile="hana"
                    x={x - markerOffset}
                    y={chart.yFor(day.hanaEmotion)}
                    useProfileMark={range === 7 || index === latestHanaIndex}
                  />
                ) : null}
              </g>
            )
          })}

          {range === 7
            ? stats.days.map((day, index) => {
                const x = chart.xFor(index)
                const isFirst = index === 0
                const isLast = index === stats.days.length - 1
                return (
                  <text
                    key={`emotion-date-${day.dateKey}`}
                    x={x}
                    y="202"
                    textAnchor="middle"
                    className={`together-chart-axis together-emotion-date${isLast ? ' together-emotion-date-today' : ''}`}
                  >
                    <tspan x={x}>{formatAxisDay(day.dateKey)}</tspan>
                    {isFirst || isLast ? (
                      <tspan x={x} dy="13">
                        {isLast ? 'Today' : formatAxisMonth(day.dateKey)}
                      </tspan>
                    ) : null}
                  </text>
                )
              })
            : chart.dateTickIndices.map((index) => (
                <text
                  key={stats.days[index].dateKey}
                  x={chart.xFor(index)}
                  y="216"
                  textAnchor={
                    index === 0
                      ? 'start'
                      : index === stats.days.length - 1
                        ? 'end'
                        : 'middle'
                  }
                  className="together-chart-axis together-emotion-date"
                >
                  {index === stats.days.length - 1
                    ? 'Today'
                    : formatAxisDate(stats.days[index].dateKey)}
                </text>
              ))}
        </svg>

        {!hasEvidence ? (
          <p className="together-chart-empty">Emotion history is still gathering</p>
        ) : null}
      </div>

      <div className="together-chart-legend mt-1" aria-hidden="true">
        <span>
          <FlowerMark className="together-emotion-legend-icon together-emotion-legend-icon-hana" />
          Hana
        </span>
        <span>
          <SunMark className="together-emotion-legend-icon together-emotion-legend-icon-cramble" />
          Cramble
        </span>
      </div>
      <p className="together-emotion-caption">
        <strong>Full {range}-day window:</strong> Hana {hanaRecorded}{' '}
        {hanaRecorded === 1 ? 'day' : 'days'} · Cramble {crambleRecorded}{' '}
        {crambleRecorded === 1 ? 'day' : 'days'} recorded. Blank days stay
        neutral.
      </p>

      <ul className="sr-only">
        {stats.days.map((day) => (
          <li key={day.dateKey}>
            {formatAccessibleDate(day.dateKey)}: Hana{' '}
            {emotionLabel(day.hanaEmotion)}; Cramble{' '}
            {emotionLabel(day.crambleEmotion)}.
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmotionChartMarker({
  profile,
  x,
  y,
  useProfileMark,
}: {
  profile: 'hana' | 'cramble'
  x: number
  y: number
  useProfileMark: boolean
}) {
  if (useProfileMark) {
    const Mark = profile === 'hana' ? FlowerMark : SunMark
    return (
      <Mark
        x={x - 7}
        y={y - 7}
        width="14"
        height="14"
        className={`together-emotion-symbol together-emotion-symbol-${profile}`}
      />
    )
  }

  if (profile === 'hana') {
    return (
      <circle
        cx={x}
        cy={y}
        r="4.1"
        className="together-chart-dot-hana together-emotion-dot-hana"
      />
    )
  }

  return (
    <rect
      x={x - 4.5}
      y={y - 4.5}
      width="9"
      height="9"
      rx="1.4"
      transform={`rotate(45 ${x} ${y})`}
      className="together-chart-dot-cramble together-emotion-dot-cramble"
    />
  )
}

function ProfileRhythmCard({
  profile,
  summary,
}: {
  profile: 'hana' | 'cramble'
  summary: ProfileComparisonSummary
}) {
  const isHana = profile === 'hana'
  const name = isHana ? 'Hana' : 'Cramble'
  const Mark = isHana ? FlowerMark : SunMark

  return (
    <article className="together-profile-card" data-profile={profile}>
      <Mark className="together-profile-mark" />
      <h3 className="mt-2 text-base font-semibold text-ink">{name}</h3>
      {summary.settledRate === null ? (
        <p className="mt-3 text-lg font-semibold text-ink">Still gathering</p>
      ) : (
        <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          {summary.settledRate}%
        </p>
      )}
      <p className="mt-0.5 text-xs text-muted">
        {summary.settledWindows === 0
          ? 'No settled goals yet'
          : `${summary.settledCompleted} of ${summary.settledWindows} resolved goals`}
      </p>
      <div className="together-active-days mt-4">
        <CalendarDays className="size-4" aria-hidden="true" />
        <span>
          {summary.activeDays} active {summary.activeDays === 1 ? 'day' : 'days'}
        </span>
      </div>
    </article>
  )
}

function ConsistencyTrend({ stats }: { stats: CombinedStatsResult }) {
  const chart = getChartGeometry(stats.trend)
  const hasEvidence = stats.trend.some(
    (bucket) => bucket.hanaRate !== null || bucket.crambleRate !== null,
  )
  const summary = [
    trendSummary('Hana', stats.trend.map((bucket) => bucket.hanaRate)),
    trendSummary('Cramble', stats.trend.map((bucket) => bucket.crambleRate)),
  ].join(' ')

  return (
    <section className="together-trend-card" aria-labelledby="consistency-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="consistency-title" className="together-section-title">
          Consistency trend
        </h2>
        <div className="together-chart-legend" aria-hidden="true">
          <span><i data-profile="hana" />Hana</span>
          <span><i data-profile="cramble" />Cramble</span>
        </div>
      </div>
      <p className="sr-only">{summary}</p>
      <div className="relative mt-3">
        <svg
          viewBox="0 0 360 190"
          className="w-full"
          role="img"
          aria-label="Settled goal rate over the selected range"
        >
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = chart.yFor(tick)
            return (
              <g key={tick}>
                <line
                  x1="42"
                  x2="346"
                  y1={y}
                  y2={y}
                  className="together-chart-grid"
                />
                <text x="35" y={y + 4} textAnchor="end" className="together-chart-axis">
                  {tick}%
                </text>
              </g>
            )
          })}

          {chart.hanaSegments.map((segment, index) => (
            <polyline
              key={`hana-${index}`}
              points={segment}
              className="together-chart-line together-chart-line-hana"
            />
          ))}
          {chart.crambleSegments.map((segment, index) => (
            <polyline
              key={`cramble-${index}`}
              points={segment}
              className="together-chart-line together-chart-line-cramble"
            />
          ))}

          {stats.trend.map((bucket, index) => {
            const x = chart.xFor(index)
            return (
              <g key={bucket.startDate}>
                {bucket.hanaRate !== null ? (
                  <circle
                    cx={x}
                    cy={chart.yFor(bucket.hanaRate)}
                    r="4.2"
                    className="together-chart-dot-hana"
                  />
                ) : null}
                {bucket.crambleRate !== null ? (
                  <rect
                    x={x - 4}
                    y={chart.yFor(bucket.crambleRate) - 4}
                    width="8"
                    height="8"
                    rx="1.5"
                    transform={`rotate(45 ${x} ${chart.yFor(bucket.crambleRate)})`}
                    className="together-chart-dot-cramble"
                  />
                ) : null}
                <text
                  x={x}
                  y="181"
                  textAnchor="middle"
                  className="together-chart-axis together-chart-label"
                >
                  {formatAxisDate(bucket.startDate)}
                </text>
              </g>
            )
          })}
        </svg>
        {!hasEvidence ? (
          <p className="together-chart-empty">Trend still forming</p>
        ) : null}
      </div>
    </section>
  )
}

function StrongestRhythmCard({
  profile,
  summary,
}: {
  profile: 'hana' | 'cramble'
  summary: ProfileComparisonSummary
}) {
  const isHana = profile === 'hana'
  const Mark = isHana ? FlowerMark : SunMark
  const name = isHana ? 'Hana' : 'Cramble'

  return (
    <article className="together-strongest-card" data-profile={profile}>
      <div className="flex items-center gap-2">
        <Mark className="together-strongest-mark" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            {summary.strongestHabit?.title ?? 'Trend still forming'}
          </p>
        </div>
      </div>
      {summary.strongestHabit ? (
        <div className="together-strongest-rate">
          <span>{summary.strongestHabit.rate}%</span>
          <small>
            {summary.strongestHabit.settledWindows} settled goals
          </small>
        </div>
      ) : (
        <p className="together-forming-copy mt-4 text-xs leading-5">
          Three settled windows will reveal this rhythm.
        </p>
      )}
    </article>
  )
}

function JourneyPaths() {
  return (
    <svg
      viewBox="0 0 360 112"
      className="together-paths"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hana-path" x1="0" x2="1">
          <stop offset="0" stopColor="#f5c8d1" stopOpacity="0.3" />
          <stop offset="1" stopColor="#df91a4" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="cramble-path" x1="1" x2="0">
          <stop offset="0" stopColor="#f6d397" stopOpacity="0.3" />
          <stop offset="1" stopColor="#dfa13b" stopOpacity="0.68" />
        </linearGradient>
      </defs>
      <path d="M0 105C54 83 99 93 159 48" fill="none" stroke="url(#hana-path)" strokeWidth="30" strokeLinecap="round" />
      <path d="M360 105C306 83 261 93 201 48" fill="none" stroke="url(#cramble-path)" strokeWidth="30" strokeLinecap="round" />
      <path d="M180 92V48" stroke="#73805a" strokeWidth="3" strokeLinecap="round" />
      <path d="M179 63c-17-2-22-13-22-23 14 1 23 7 22 23Z" fill="#b7c590" stroke="#73805a" strokeWidth="1.5" />
      <path d="M181 58c16-2 21-12 20-21-13 1-21 7-20 21Z" fill="#d1d9a8" stroke="#73805a" strokeWidth="1.5" />
      <circle cx="55" cy="37" r="3" fill="#e49bae" opacity="0.62" />
      <circle cx="302" cy="31" r="3" fill="#e5ad4e" opacity="0.66" />
      <path d="M28 48l5 5m0-5-5 5M327 48l5 5m0-5-5 5" stroke="#d7ae79" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function getChartGeometry(buckets: ComparisonTrendBucket[]) {
  const xFor = (index: number) =>
    buckets.length <= 1 ? 194 : 50 + (index * 288) / (buckets.length - 1)
  const yFor = (rate: number) => 154 - (Math.max(0, Math.min(100, rate)) / 100) * 126
  const segmentsFor = (key: 'hanaRate' | 'crambleRate') => {
    const segments: string[] = []
    let points: string[] = []
    buckets.forEach((bucket, index) => {
      const rate = bucket[key]
      if (rate === null) {
        if (points.length > 1) segments.push(points.join(' '))
        points = []
        return
      }
      points.push(`${xFor(index)},${yFor(rate)}`)
    })
    if (points.length > 1) segments.push(points.join(' '))
    return segments
  }

  return {
    xFor,
    yFor,
    hanaSegments: segmentsFor('hanaRate'),
    crambleSegments: segmentsFor('crambleRate'),
  }
}

function trendSummary(name: string, rates: Array<number | null>) {
  const available = rates.filter((rate): rate is number => rate !== null)
  if (available.length === 0) return `${name}'s trend is still forming.`
  return `${name}'s settled rates in this range are ${available.join(', ')} percent.`
}

function formatAxisDate(dateKey: string) {
  return `${formatAxisMonth(dateKey)} ${formatAxisDay(dateKey)}`
}

function formatAxisDay(dateKey: string) {
  return String(Number(dateKey.slice(-2)))
}

function formatAxisMonth(dateKey: string) {
  const [, month] = dateKey.split('-').map(Number)
  return [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][month - 1]
}

function getLatestRecordedEmotionIndex(
  stats: CombinedEmotionStats,
  profile: 'hana' | 'cramble',
) {
  for (let index = stats.days.length - 1; index >= 0; index -= 1) {
    const emotion =
      profile === 'hana'
        ? stats.days[index].hanaEmotion
        : stats.days[index].crambleEmotion
    if (emotion !== null) return index
  }
  return -1
}

function getEmotionChartGeometry(stats: CombinedEmotionStats) {
  const dayCount = stats.days.length
  const xFor = (index: number) =>
    dayCount <= 1 ? 204 : 68 + (index * 272) / (dayCount - 1)
  const yFor = (emotion: DailyEmotion) =>
    26 + EMOTIONS_BEST_FIRST.indexOf(emotion) * 38
  const indexByDate = new Map(
    stats.days.map((day, index) => [day.dateKey, index]),
  )
  const segmentsFor = (profile: 'hana' | 'cramble') => {
    const days = stats.days.map((day) => ({
      dateKey: day.dateKey,
      emotion:
        profile === 'hana' ? day.hanaEmotion : day.crambleEmotion,
    }))
    return getEmotionTimelineRuns(days)
      .filter((run) => run.length > 1)
      .map((run) =>
        run
          .map((day) => {
            const index = indexByDate.get(day.dateKey) ?? 0
            return `${xFor(index)},${yFor(day.emotion)}`
          })
          .join(' '),
      )
  }

  return {
    xFor,
    yFor,
    hanaSegments: segmentsFor('hana'),
    crambleSegments: segmentsFor('cramble'),
    dateTickIndices: getEmotionDateTickIndices(dayCount),
  }
}

function getEmotionDateTickIndices(dayCount: number) {
  if (dayCount <= 0) return []
  if (dayCount === 1) return [0]
  const last = dayCount - 1
  const divisions = dayCount <= 7 ? 2 : 3
  return Array.from(
    new Set(
      Array.from({ length: divisions + 1 }, (_, index) =>
        Math.round((last * index) / divisions),
      ),
    ),
  )
}

function emotionLabel(emotion: DailyEmotion | null) {
  return emotion ? DAILY_EMOTION_LABELS[emotion] : 'not recorded'
}

function formatAccessibleDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12))
}
