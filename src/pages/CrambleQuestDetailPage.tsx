import {
  CalendarDays,
  Check,
  ChevronLeft,
  CircleDot,
  Clock3,
  Target,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { crambleQuests } from '@/data/crambleQuests'
import { HabitMomentumBadge } from '@/components/HabitMomentumBadge'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { getQuestCatalog } from '@/lib/hanaGame'
import {
  formatQuestCadence,
  getHabitRangeStats,
  getHabitMomentumSignal,
  type HabitDayStat,
  type HabitPeriodStat,
  type HabitPeriodStatus,
  type HabitRangeStats,
  type HabitStatsRange,
} from '@/lib/hanaStats'
import type { HanaGameState, Quest } from '@/types'
import {
  isHabitArchivedOnDate,
  isHabitPausedOnDate,
} from '@/lib/habitLifecycle'

type Props = {
  game: HanaGameState
  questId: string
  onBack: () => void
}

const RANGE_OPTIONS: Array<{ value: HabitStatsRange; label: string; name: string }> = [
  { value: 7, label: '7D', name: 'Past 7 days' },
  { value: 30, label: '30D', name: 'Past 30 days' },
  { value: 90, label: '90D', name: 'Past 90 days' },
  { value: 'all', label: 'All', name: 'All recorded time' },
]

const MONDAY_FIRST_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CrambleQuestDetailPage({ game, questId, onBack }: Props) {
  return (
    <HabitQuestDetailPage
      game={game}
      questId={questId}
      onBack={onBack}
      baseQuests={crambleQuests}
      profileId="cramble"
    />
  )
}

type HabitQuestDetailPageProps = Props & {
  baseQuests: Quest[]
  profileId: HanaProfileId
}

export function HabitQuestDetailPage({
  game,
  questId,
  onBack,
  baseQuests,
  profileId,
}: HabitQuestDetailPageProps) {
  const headingRef = usePageHeadingFocus()
  const isCramble = profileId === 'cramble'
  const rangeResultsId = `${profileId}-ledger-range-results`
  const rangeHeadingId = `${profileId}-ledger-range-heading`
  const quest = getQuestCatalog(baseQuests, game).find(
    (candidate) => candidate.id === questId,
  )
  const defaultRange = getDefaultRange(quest)
  const [range, setRange] = useState<HabitStatsRange>(defaultRange)
  const periodStripRef = useRef<HTMLDivElement>(null)
  const stats = getHabitRangeStats(
    game,
    baseQuests,
    profileId,
    questId,
    range,
  )
  const allTimeStats = getHabitRangeStats(
    game,
    baseQuests,
    profileId,
    questId,
    'all',
  )
  const momentum = allTimeStats
    ? getHabitMomentumSignal(allTimeStats, profileId)
    : null
  const lifecycleStatus = quest
    ? isHabitArchivedOnDate(game, quest.id)
      ? 'archived'
      : isHabitPausedOnDate(game, quest.id)
        ? 'paused'
        : 'active'
    : 'active'

  useEffect(() => {
    setRange(defaultRange)
  }, [defaultRange, questId])

  useEffect(() => {
    const strip = periodStripRef.current
    if (!strip) return

    strip.scrollLeft = strip.scrollWidth
  }, [questId, range, stats?.periods.length])

  if (!quest || !stats) {
    return (
      <div
        className={`${isCramble ? 'cramble-archive-shell' : 'stats-page-shell hana-ledger-shell'} habit-ledger-detail-shell mx-auto min-h-full w-full max-w-md px-5 pb-12 pt-6`}
        data-profile={profileId}
      >
        {isCramble ? (
          <div className="cramble-decor-layer" aria-hidden="true" />
        ) : null}
        <DetailTopBar onBack={onBack} />
        <section className="habit-ledger-card relative z-10 rounded-card border border-border bg-surface p-5 text-center shadow-sm">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-ink outline-none"
          >
            Record unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            This quest is no longer in the archive. Return to the Ledger to
            choose another record.
          </p>
        </section>
      </div>
    )
  }

  const cadence = formatQuestCadence(quest)
  const hasExactDailyActivity = quest.group === 'daily'
  const activeRecordDays = stats.days.filter((day) => day.count > 0).length
  const busiestWeekday = getBusiestWeekday(stats)
  const targetValue = stats.decidedPeriods
    ? `${stats.completedPeriods}/${stats.decidedPeriods}`
    : '—'
  const targetNote = stats.decidedPeriods
    ? `${stats.successRate}% of resolved windows`
    : 'No resolved windows yet'

  return (
    <div
      className={`${isCramble ? 'cramble-archive-shell' : 'stats-page-shell hana-ledger-shell'} habit-ledger-detail-shell mx-auto min-h-full w-full max-w-md px-5 pb-12 pt-6`}
      data-profile={profileId}
    >
      {isCramble ? (
        <div className="cramble-decor-layer" aria-hidden="true" />
      ) : null}
      <DetailTopBar onBack={onBack} />

      <header className="habit-ledger-card cramble-ledger-detail-header relative z-10 rounded-[24px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span
            className="cramble-ledger-detail-emblem grid size-14 shrink-0 place-items-center rounded-full text-3xl"
            style={{
              backgroundColor: `${quest.color}1f`,
              boxShadow: `inset 0 0 0 1px ${quest.color}66`,
            }}
            aria-hidden="true"
          >
            {quest.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
              {cadence}
              {lifecycleStatus === 'active'
                ? ''
                : ` / ${lifecycleStatus === 'paused' ? 'Paused' : 'Archived'}`}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-3xl font-semibold tracking-tight text-ink outline-none"
            >
              {quest.title}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{quest.description}</p>
        {momentum ? (
          <div className="mt-3">
            <HabitMomentumBadge signal={momentum} profile={profileId} />
          </div>
        ) : null}
      </header>

      <CurrentPeriodCard
        period={stats.currentPeriod}
        nextDueDate={stats.nextDueDate}
        lifecycleStatus={lifecycleStatus}
      />

      <section
        id={`${profileId}-ledger-detail-range`}
        className="relative z-10 mt-6"
        aria-labelledby={rangeHeadingId}
      >
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              History
            </p>
            <h2 id={rangeHeadingId} className="mt-1 text-xl font-semibold text-ink">
              Choose a view
            </h2>
          </div>
          <p className="text-right text-xs text-faint">
            {formatDateRange(stats.rangeStart, stats.rangeEnd)}
          </p>
        </div>

        <div
          className="ledger-range-control mt-3"
          role="group"
          aria-label="History range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className="ledger-range-button"
              data-selected={range === option.value}
              aria-pressed={range === option.value}
              aria-label={option.name}
              aria-controls={rangeResultsId}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div id={rangeResultsId}>
        <p className="sr-only" role="status">
          Showing {formatRangeName(range).toLowerCase()} for {quest.title}, from{' '}
          {formatDate(stats.rangeStart, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          through{' '}
          {formatDate(stats.rangeEnd, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}.
        </p>
        <section
          className="ledger-detail-metrics relative z-10 mt-4 grid grid-cols-3 gap-3"
          aria-label={`Summary for ${formatDateRange(stats.rangeStart, stats.rangeEnd)}`}
        >
          <LedgerMetric
            icon={<Target className="size-4" aria-hidden="true" />}
            label="Targets met"
            value={targetValue}
            note={targetNote}
          />
          <LedgerMetric
            icon={<Check className="size-4" aria-hidden="true" />}
            label={hasExactDailyActivity ? 'Records' : 'Completed'}
            value={String(
              hasExactDailyActivity
                ? stats.totalRecords
                : stats.completedPeriods,
            )}
            note={
              hasExactDailyActivity
                ? `${activeRecordDays} active ${activeRecordDays === 1 ? 'day' : 'days'}`
                : `${stats.completedPeriods === 1 ? 'goal window' : 'goal windows'} met`
            }
          />
          <LedgerMetric
            icon={<Clock3 className="size-4" aria-hidden="true" />}
            label={hasExactDailyActivity ? 'Weekly pace' : 'Passed'}
            value={
              hasExactDailyActivity
                ? formatPace(stats.weeklyPace)
                : String(stats.skippedPeriods)
            }
            note={
              hasExactDailyActivity
                ? 'records per week'
                : 'windows without penalty'
            }
          />
        </section>

        <section className="habit-ledger-card ledger-period-card relative z-10 mt-5 rounded-card border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                Period rhythm
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Each target window
              </h2>
            </div>
            <span className="ledger-period-total rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
              {stats.periods.length}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Every mark is one full scoring window, so weekly and custom goals
            are never mistaken for daily misses.
          </p>

          {stats.periods.length ? (
            <div
              ref={periodStripRef}
              className="ledger-period-strip mt-4"
              role="region"
              aria-label={getPeriodSummary(stats)}
              tabIndex={0}
            >
              <ol className="ledger-period-list">
                {stats.periods.map((period) => (
                  <PeriodToken key={period.periodKey} period={period} />
                ))}
              </ol>
            </div>
          ) : (
            <p className="ledger-empty-state mt-4 rounded-2xl border border-border bg-surface-2 p-4 text-sm leading-6 text-muted">
              No target window has entered this range yet. The next one can be
              the first mark.
            </p>
          )}
        </section>

        {hasExactDailyActivity ? (
        <section className="habit-ledger-card ledger-activity-card relative z-10 mt-5 rounded-card border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="ledger-section-icon grid size-9 shrink-0 place-items-center rounded-full">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                When it happened
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Daily activity
              </h2>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Stronger marks mean more records on that day. Days without a record
            stay neutral; unfinished goals appear only in the period rhythm.
          </p>

          <ActivityGrid stats={stats} />
          <ActivityLegend />
        </section>
        ) : (
          <section className="habit-ledger-card relative z-10 mt-5 rounded-card border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="ledger-section-icon grid size-9 shrink-0 place-items-center rounded-full">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                  Window history
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">
                  Exact day not recorded
                </h2>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              This long-term quest stores whether its full window was completed,
              not the exact day it happened. The period rhythm above remains
              accurate.
            </p>
          </section>
        )}

        <section className="ledger-insight-card relative z-10 mt-5 rounded-card border border-border p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="ledger-section-icon grid size-9 shrink-0 place-items-center rounded-full">
              <CircleDot className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                A useful clue
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {getInsight(stats, busiestWeekday)}
              </p>
            </div>
          </div>
        </section>
      </div>

      <p className="ledger-kind-note relative z-10 mt-7 text-center text-xs leading-5 text-faint">
        This is a record, not a verdict. Every new window begins without debt.
      </p>
    </div>
  )
}

function DetailTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="cramble-ledger-detail-topbar relative z-10 mb-6 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the Ledger"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <span className="rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted">
        Quest record
      </span>
    </div>
  )
}

function CurrentPeriodCard({
  period,
  nextDueDate,
  lifecycleStatus,
}: {
  period: HabitPeriodStat | null
  nextDueDate: string | null
  lifecycleStatus: 'active' | 'paused' | 'archived'
}) {
  if (!period) {
    return (
      <section className="habit-ledger-card ledger-current-period relative z-10 mt-5 rounded-card border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="ledger-section-icon grid size-10 shrink-0 place-items-center rounded-full">
            <Clock3 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              Between windows
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">
              {lifecycleStatus === 'paused'
                ? 'Paused - no due date or backlog'
                : lifecycleStatus === 'archived'
                  ? 'Archived - history only'
                  : nextDueDate
                ? `Next due ${formatDate(nextDueDate, { weekday: 'long', month: 'short', day: 'numeric' })}`
                : 'No open window today'}
            </h2>
          </div>
        </div>
      </section>
    )
  }

  const percent = Math.min(
    100,
    Math.round((period.completed / Math.max(1, period.target)) * 100),
  )
  const remaining = Math.max(0, period.target - period.completed)
  const statusLabel = getPeriodStatusLabel(period.status)
  const supportingText =
    period.status === 'completed'
      ? 'The full target is met.'
      : period.status === 'skipped'
        ? 'This window was passed without penalty.'
        : period.status === 'paused'
          ? 'Tracking was paused. This window is neutral and creates no debt.'
        : `${remaining} ${remaining === 1 ? 'record' : 'records'} still available in this window.`

  return (
    <section
      className="habit-ledger-card ledger-current-period relative z-10 mt-5 rounded-card border border-border bg-surface p-4 shadow-sm"
      data-status={period.status}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
            Current window
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {statusLabel} · {period.completed}/{period.target}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">{supportingText}</p>
        </div>
        <span className="ledger-current-symbol" aria-hidden="true">
          {getPeriodStatusSymbol(period.status)}
        </span>
      </div>
      <div
        className="ledger-current-progress mt-4"
        role="progressbar"
        aria-label={`Current target: ${period.completed} of ${period.target} recorded`}
        aria-valuemin={0}
        aria-valuemax={period.target}
        aria-valuenow={Math.min(period.completed, period.target)}
      >
        <span
          className="ledger-current-progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-right text-[11px] tabular-nums text-faint">
        {formatPeriodRange(period)}
      </p>
    </section>
  )
}

function LedgerMetric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <div className="habit-ledger-card ledger-detail-metric rounded-card border border-border bg-surface p-3 text-center shadow-sm">
      <span className="ledger-metric-icon mx-auto flex size-8 items-center justify-center rounded-full">
        {icon}
      </span>
      <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-muted">{note}</p>
    </div>
  )
}

function PeriodToken({ period }: { period: HabitPeriodStat }) {
  return (
    <li
      className="ledger-period-token"
      data-status={period.status}
      aria-label={`${formatPeriodRange(period, true)}. ${getPeriodStatusLabel(period.status)}. ${period.completed} of ${period.target} recorded.`}
    >
      <span className="ledger-period-symbol" aria-hidden="true">
        {getPeriodStatusSymbol(period.status)}
      </span>
      <span className="ledger-period-count tabular-nums" aria-hidden="true">
        {period.completed}/{period.target}
      </span>
      <span className="ledger-period-date" aria-hidden="true">
        {formatPeriodRange(period)}
      </span>
      <span className="ledger-period-status" aria-hidden="true">
        {getPeriodStatusLabel(period.status)}
      </span>
    </li>
  )
}

function ActivityGrid({ stats }: { stats: HabitRangeStats }) {
  const leadingBlanks = stats.days[0]
    ? (parseDateKey(stats.days[0].dateKey).getDay() + 6) % 7
    : 0
  const activitySummary = getActivitySummary(stats)

  return (
    <div
      className="ledger-activity-figure mt-4"
      role="img"
      aria-label={activitySummary}
    >
      <div className="ledger-activity-grid" aria-hidden="true">
        {MONDAY_FIRST_WEEKDAYS.map((weekday) => (
          <span key={weekday} className="ledger-weekday-label">
            {weekday}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span
            key={`leading-${index}`}
            className="ledger-activity-day ledger-activity-day-empty"
          />
        ))}
        {stats.days.map((day) => (
          <ActivityDay key={day.dateKey} day={day} />
        ))}
      </div>
    </div>
  )
}

function ActivityDay({ day }: { day: HabitDayStat }) {
  const dayNumber = Number(day.dateKey.slice(-2))
  const monthLabel =
    dayNumber === 1
      ? formatDate(day.dateKey, { month: 'short' })
      : null

  return (
    <span
      className="ledger-activity-day"
      data-level={Math.min(3, day.count)}
      data-eligible={day.isEligible}
      data-paused={day.isPaused}
      data-today={day.isToday}
    >
      <span className="ledger-activity-day-number">{dayNumber}</span>
      {monthLabel ? (
        <span className="ledger-activity-month">{monthLabel}</span>
      ) : null}
      {day.count > 0 ? (
        <span className="ledger-activity-count">
          {day.count > 9 ? '9+' : day.count}
        </span>
      ) : null}
    </span>
  )
}

function ActivityLegend() {
  return (
    <div className="ledger-legend mt-4" role="list" aria-label="Chart legend">
      <span role="listitem">
        <i data-kind="recorded" aria-hidden="true" /> Recorded
      </span>
      <span role="listitem">
        <i data-kind="open" aria-hidden="true" /> Today
      </span>
      <span role="listitem">
        <i data-kind="empty" aria-hidden="true" /> No record
      </span>
      <span role="listitem">
        <i data-kind="not-due" aria-hidden="true" /> Not scheduled
      </span>
      <span role="listitem">
        <i data-kind="paused" aria-hidden="true" /> Paused
      </span>
    </div>
  )
}

function getDefaultRange(quest: Quest | undefined): HabitStatsRange {
  if (!quest) return 30
  if (quest.group === 'longTerm') return 90

  const schedule = quest.schedule ?? { kind: 'daily' as const }
  if (schedule.kind === 'weekly') return 90
  if (
    (schedule.kind === 'quota' || schedule.kind === 'periodTarget') &&
    schedule.periodDays >= 7
  ) {
    return 90
  }
  return 30
}

function getPeriodStatusLabel(status: HabitPeriodStatus) {
  if (status === 'completed') return 'Met'
  if (status === 'skipped') return 'Passed'
  if (status === 'paused') return 'Paused'
  if (status === 'missed') return 'Unfinished'
  return 'In progress'
}

function getPeriodStatusSymbol(status: HabitPeriodStatus) {
  if (status === 'completed') return '✓'
  if (status === 'skipped') return '◇'
  if (status === 'paused') return 'Ⅱ'
  if (status === 'missed') return '—'
  return '◐'
}

function getPeriodSummary(stats: HabitRangeStats) {
  const closedSummary = stats.decidedPeriods
    ? `${stats.completedPeriods} of ${stats.decidedPeriods} resolved targets met, ${stats.successRate} percent.`
    : 'No target windows are resolved in this range.'
  const openSummary = stats.periods.some(({ status }) => status === 'open')
    ? 'The latest target window is still in progress.'
    : ''
  const passSummary = stats.skippedPeriods
    ? `${stats.skippedPeriods} ${stats.skippedPeriods === 1 ? 'window was' : 'windows were'} passed.`
    : ''
  const pauseSummary = stats.pausedPeriods
    ? `${stats.pausedPeriods} ${stats.pausedPeriods === 1 ? 'window was' : 'windows were'} neutral while tracking was paused.`
    : ''

  return `Period rhythm, oldest to newest. ${closedSummary} ${openSummary} ${passSummary} ${pauseSummary}`.trim()
}

function getActivitySummary(stats: HabitRangeStats) {
  const activeDays = stats.days.filter((day) => day.count > 0).length
  const busiest = getBusiestWeekday(stats)
  const busiestSummary = busiest
    ? `${busiest.label} has the most records, with ${busiest.records}.`
    : 'No day has a record yet.'

  return `Daily activity from ${formatDate(stats.rangeStart, { month: 'long', day: 'numeric', year: 'numeric' })} through ${formatDate(stats.rangeEnd, { month: 'long', day: 'numeric', year: 'numeric' })}. ${stats.totalRecords} total ${stats.totalRecords === 1 ? 'record' : 'records'} across ${activeDays} active ${activeDays === 1 ? 'day' : 'days'}. ${busiestSummary}`
}

function getBusiestWeekday(stats: HabitRangeStats) {
  const busiest = [...stats.weekdayRecords].sort(
    (first, second) => second.records - first.records || first.weekday - second.weekday,
  )[0]
  return busiest && busiest.records > 0 ? busiest : null
}

function getInsight(
  stats: HabitRangeStats,
  busiestWeekday: HabitRangeStats['weekdayRecords'][number] | null,
) {
  if (stats.totalRecords === 0) {
    return 'No pattern needs explaining yet. The next small act can write the opening mark.'
  }
  if (stats.decidedPeriods === 0) {
    return `${stats.totalRecords} ${stats.totalRecords === 1 ? 'step is' : 'steps are'} already recorded while the first window is still taking shape.`
  }
  if (busiestWeekday) {
    return `Your steps gather most often on ${busiestWeekday.label}s. Treat that as a useful clue, not a rule you have to obey.`
  }
  return 'The rhythm is still forming. A blank day carries information, never debt.'
}

function formatPace(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatRangeName(range: HabitStatsRange) {
  return RANGE_OPTIONS.find((option) => option.value === range)?.name ?? 'History'
}

function formatPeriodRange(period: HabitPeriodStat, verbose = false) {
  if (period.startDate === period.endDate) {
    return formatDate(period.startDate, {
      month: verbose ? 'long' : 'short',
      day: 'numeric',
      year: verbose ? 'numeric' : undefined,
    })
  }

  const start = parseDateKey(period.startDate)
  const end = parseDateKey(period.endDate)
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  if (sameMonth && !verbose) {
    return `${formatDate(period.startDate, { month: 'short', day: 'numeric' })}–${formatDate(period.endDate, { day: 'numeric' })}`
  }

  const options: Intl.DateTimeFormatOptions = verbose
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' }
  return `${formatDate(period.startDate, options)}–${formatDate(period.endDate, options)}`
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatDate(startDate, { month: 'short', day: 'numeric' })
  }
  return `${formatDate(startDate, { month: 'short', day: 'numeric' })} – ${formatDate(endDate, { month: 'short', day: 'numeric' })}`
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, options)
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
