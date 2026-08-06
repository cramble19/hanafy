import type { ReactNode } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Leaf,
  Shield,
} from 'lucide-react'
import { crambleQuests } from '@/data/crambleQuests'
import { HabitMomentumBadge } from '@/components/HabitMomentumBadge'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { getLevel, getQuestCatalog } from '@/lib/hanaGame'
import {
  formatQuestCadence,
  getHabitRangeStats,
  getHabitMomentumSignal,
  getProfileStats,
} from '@/lib/hanaStats'
import type { HanaGameState, Quest } from '@/types'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenQuest: (questId: string) => void
}

export function CrambleLedgerPage({ game, onBack, onOpenQuest }: Props) {
  return (
    <HabitLedgerPage
      game={game}
      baseQuests={crambleQuests}
      profileId="cramble"
      onBack={onBack}
      onOpenQuest={onOpenQuest}
    />
  )
}

type HabitLedgerPageProps = Props & {
  baseQuests: Quest[]
  profileId: HanaProfileId
}

export function HabitLedgerPage({
  game,
  baseQuests,
  profileId,
  onBack,
  onOpenQuest,
}: HabitLedgerPageProps) {
  const headingRef = usePageHeadingFocus()
  const isCramble = profileId === 'cramble'
  const level = getLevel(game.totalFlowers)
  const stats = getProfileStats(game, baseQuests, profileId)
  const statByQuestId = new Map(
    stats.questStats.map((questStat) => [questStat.questId, questStat]),
  )
  const questRecords = getQuestCatalog(baseQuests, game).map((quest) => {
    const recent = getHabitRangeStats(
      game,
      baseQuests,
      profileId,
      quest.id,
      30,
    )
    const history = getHabitRangeStats(
      game,
      baseQuests,
      profileId,
      quest.id,
      'all',
    )
    return {
      quest,
      stat: statByQuestId.get(quest.id),
      recent,
      history,
      isLocked: (quest.minLevel ?? 1) > level && !history?.periods.length,
      momentum: history
        ? getHabitMomentumSignal(history, profileId)
        : null,
    }
  })
  const allTime = questRecords.reduce(
    (total, { quest, history }) => ({
      records:
        total.records +
        (quest.group === 'longTerm'
          ? history?.completedPeriods ?? 0
          : history?.totalRecords ?? 0),
      completed: total.completed + (history?.completedPeriods ?? 0),
      missed: total.missed + (history?.missedPeriods ?? 0),
      skipped: total.skipped + (history?.skippedPeriods ?? 0),
    }),
    { records: 0, completed: 0, missed: 0, skipped: 0 },
  )
  const allTimeTargetRate =
    allTime.completed + allTime.missed === 0
      ? null
      : Math.round(
          (allTime.completed / (allTime.completed + allTime.missed)) * 100,
        )

  return (
    <div
      className={`${isCramble ? 'cramble-archive-shell' : 'stats-page-shell hana-ledger-shell'} habit-ledger-shell mx-auto min-h-full w-full max-w-md px-5 pb-12 pt-6`}
      data-profile={profileId}
    >
      {isCramble ? (
        <div className="cramble-decor-layer" aria-hidden="true" />
      ) : null}

      <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${isCramble ? "Cramble's" : "Hana's"} tracker`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted">
          Quest record
        </span>
      </div>

      <header className="habit-ledger-card relative z-10 rounded-[24px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="habit-ledger-medallion grid size-11 place-items-center rounded-full">
            {isCramble ? (
              <BookOpen className="size-5" aria-hidden="true" />
            ) : (
              <Leaf className="size-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
              {isCramble ? 'The Sunward Archive' : 'The Bloom Archive'}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-0.5 text-3xl font-semibold tracking-tight text-ink outline-none"
            >
              The Ledger
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          {isCramble
            ? 'A calm record of lessons attempted, completed, and passed. The page is information—not judgment.'
            : 'A gentle record of habits attempted, completed, and skipped. Each mark is information—not judgment.'}
        </p>
      </header>

      <section className="relative z-10 mt-5 grid grid-cols-3 gap-3">
        <LedgerMetric
          icon={<CircleCheck className="size-4" />}
          label="Records"
          value={String(allTime.records)}
          profileId={profileId}
        />
        <LedgerMetric
          icon={<Shield className="size-4" />}
          label={isCramble ? 'Passes' : 'Skips'}
          value={String(allTime.skipped)}
          profileId={profileId}
        />
        <LedgerMetric
          icon={<Clock3 className="size-4" />}
          label="Targets"
          value={allTimeTargetRate === null ? '—' : `${allTimeTargetRate}%`}
          profileId={profileId}
        />
      </section>

      <section className="habit-ledger-card relative z-10 mt-5 rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              Current week
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {isCramble ? 'Seven-page rhythm' : 'Seven-day bloom'}
            </h2>
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted">
            {stats.currentWeek.completionRate}%
          </span>
        </div>

        <div
          className="cramble-week-bars mt-5"
          role="img"
          aria-label={getWeekChartLabel(
            stats.currentWeek.days,
            stats.currentWeek.completionRate,
          )}
        >
          {stats.currentWeek.days.map((day) => (
            <div key={day.dateKey} className="cramble-week-column">
              <span className="cramble-week-track">
                <span
                  className="cramble-week-fill"
                  style={{
                    height: `${Math.max(day.completionRate, day.shown ? 8 : 0)}%`,
                  }}
                />
              </span>
              <span className="text-[10px] font-semibold uppercase text-faint">
                {formatWeekday(day.dateKey)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mt-8">
        <div className="px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
            Archive index
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Quest records</h2>
          <p className="mt-1 text-xs leading-5 text-faint">
            Open a quest to see each goal window and every recorded day.
            {' '}🔥 marks a live combo; {isCramble ? '🕯️' : '🥀'} invites a
            gentle restart only after three unfinished windows.
          </p>
          <div className="section-sigil-divider" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {questRecords.length ? (
            questRecords.map(({ quest, stat, recent, momentum, isLocked }) => (
              <button
                key={quest.id}
                type="button"
                onClick={() => onOpenQuest(quest.id)}
                className="habit-ledger-card ledger-quest-row flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-sm"
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full text-xl"
                  style={{
                    backgroundColor: `${quest.color}18`,
                    boxShadow: `inset 0 0 0 1px ${quest.color}55`,
                  }}
                  aria-hidden="true"
                >
                  {quest.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-ink">
                      {quest.title}
                    </span>
                    <HabitMomentumBadge
                      signal={momentum}
                      profile={profileId}
                      compact
                    />
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatQuestCadence(quest)}
                  </span>
                  <span className="mt-2 flex min-h-2 items-center gap-1" aria-hidden="true">
                    {recent?.periods.slice(-6).map((period) => (
                      <span
                        key={period.periodKey}
                        className="ledger-recent-mark"
                        data-status={period.status}
                      />
                    ))}
                  </span>
                  <span className="sr-only">
                    {isLocked
                      ? `Unlocks at level ${quest.minLevel}. Open task preview.`
                      : `${recent?.completedPeriods ?? stat?.completed ?? 0} of ${recent?.decidedPeriods ?? stat?.shown ?? 0} recent targets met. Open task history.`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted">
                  <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
                    {isLocked
                      ? `Level ${quest.minLevel}`
                      : recent?.decidedPeriods
                      ? `${recent.successRate}% · 30D`
                      : 'New'}
                  </span>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </button>
            ))
          ) : (
            <div className="habit-ledger-card rounded-card border border-border bg-surface p-5 text-center text-sm leading-6 text-muted shadow-sm">
              {isCramble
                ? 'The ledger is ready. Completing the first lesson will write its opening line.'
                : 'The ledger is ready. Completing the first habit will plant its opening mark.'}
            </div>
          )}
        </div>
      </section>

      <p className="relative z-10 mt-8 text-center text-xs leading-5 text-faint">
        {isCramble
          ? 'The page turns. Begin again whenever you are ready.'
          : 'Every new window is another place to begin.'}
      </p>
    </div>
  )
}

function LedgerMetric({
  icon,
  label,
  value,
  profileId,
}: {
  icon: ReactNode
  label: string
  value: string
  profileId: HanaProfileId
}) {
  return (
    <div className="habit-ledger-card rounded-card border border-border bg-surface p-3 text-center shadow-sm">
      <span
        className="mx-auto flex size-8 items-center justify-center rounded-full bg-surface-2 text-[color:var(--ledger-secondary)]"
        data-profile={profileId}
      >
        {icon}
      </span>
      <p className="mt-2 text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
    </div>
  )
}

function formatWeekday(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
  })
}

function getWeekChartLabel(
  days: Array<{ dateKey: string; completionRate: number }>,
  completionRate: number,
) {
  const daySummary = days
    .map(
      (day) =>
        `${dateFromKey(day.dateKey).toLocaleDateString(undefined, {
          weekday: 'long',
        })}: ${day.completionRate}%`,
    )
    .join(', ')

  return `Current week completion rate ${completionRate}%. ${daySummary}.`
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
