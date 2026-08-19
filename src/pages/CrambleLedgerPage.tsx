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
import { EmotionFaceIcon } from '@/components/icons/EmotionFaceIcon'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { getLevel, getQuestCatalog } from '@/lib/hanaGame'
import {
  formatQuestCadence,
  getHabitRangeStats,
  getHabitMomentumSignal,
  getProfileStats,
} from '@/lib/hanaStats'
import type { HanaGameState, OpenActivityKind, Quest } from '@/types'
import {
  isHabitArchivedOnDate,
  isHabitGraduatedOnDate,
  isHabitPausedOnDate,
} from '@/lib/habitLifecycle'
import { getOpenActivityRangeStats } from '@/lib/openActivityStats'
import { getOpenActivityCatalog } from '@/lib/openActivities'
import { DAILY_EMOTION_LABELS } from '@/lib/dailyEmotions'

type Props = {
  game: HanaGameState
  onBack: () => void
  onOpenQuest: (questId: string) => void
  onOpenEmotion: () => void
  onRestoreHabit?: (questId: string) => void
  onDeleteHabit?: (questId: string) => void
}

export function CrambleLedgerPage({
  game,
  onBack,
  onOpenQuest,
  onOpenEmotion,
  onRestoreHabit,
  onDeleteHabit,
}: Props) {
  return (
    <HabitLedgerPage
      game={game}
      baseQuests={crambleQuests}
      profileId="cramble"
      onBack={onBack}
      onOpenQuest={onOpenQuest}
      onOpenEmotion={onOpenEmotion}
      onRestoreHabit={onRestoreHabit}
      onDeleteHabit={onDeleteHabit}
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
  onOpenEmotion,
  onRestoreHabit,
  onDeleteHabit,
}: HabitLedgerPageProps) {
  const headingRef = usePageHeadingFocus()
  const isCramble = profileId === 'cramble'
  const currentEmotion = game.dailyEmotions[game.currentDate] ?? null
  const emotionRecordCount = Object.keys(game.dailyEmotions).filter(
    (dateKey) =>
      dateKey <= game.currentDate &&
      (!game.startDate || dateKey >= game.startDate),
  ).length
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
      isArchived: isHabitArchivedOnDate(game, quest.id),
      isGraduated: isHabitGraduatedOnDate(game, quest.id),
      isLegacy: quest.catalogState === 'legacy',
      isActivated: Boolean(
        game.questActivations?.[quest.id] &&
          (game.questActivations?.[quest.id] ?? '') <= game.currentDate,
      ),
      activationDate: game.questActivations?.[quest.id] ?? null,
      hasHistory: Boolean(history?.periods.length || history?.totalRecords),
      isPaused: isHabitPausedOnDate(game, quest.id),
      momentum: history
        ? getHabitMomentumSignal(history, profileId)
        : null,
    }
  })
  const currentRecords = questRecords.filter(
    (record) =>
      !record.isLocked &&
      !record.isArchived &&
      !record.isGraduated &&
      !record.isLegacy &&
      !record.isPaused &&
      (record.isActivated || record.hasHistory),
  )
  const pausedRecords = questRecords.filter(
    (record) =>
      !record.isLocked &&
      !record.isArchived &&
      !record.isGraduated &&
      !record.isLegacy &&
      record.isPaused,
  )
  const archivedRecords = questRecords.filter((record) => record.isArchived)
  const graduatedRecords = questRecords.filter(
    (record) => record.isGraduated && !record.isArchived,
  )
  const legacyRecords = questRecords.filter(
    (record) => record.isLegacy && record.hasHistory && !record.isArchived,
  )
  const futureRecords = questRecords.filter(
    (record) =>
      !record.isLegacy &&
      !record.isArchived &&
      !record.isGraduated &&
      !record.hasHistory &&
      (record.isLocked || !record.isActivated),
  )
  const activityRecords = getOpenActivityCatalog(game).map((activity) => ({
    activity,
    recent: getOpenActivityRangeStats(
      game,
      activity.id,
      activity.kind === 'count' ? 7 : 14,
    ),
    history: getOpenActivityRangeStats(game, activity.id, 'all'),
    isArchived: isHabitArchivedOnDate(game, activity.id),
    isPaused: isHabitPausedOnDate(game, activity.id),
  }))
  const currentActivityRecords = activityRecords.filter(
    (record) => !record.isArchived,
  )
  const archivedActivityRecords = activityRecords.filter(
    (record) => record.isArchived,
  )
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

  const renderQuestRecord = (
    record: (typeof questRecords)[number],
    allowRestore = false,
  ) => {
    const {
      quest,
      stat,
      recent,
      momentum,
      isLocked,
      isPaused,
      isArchived,
      isGraduated,
      isLegacy,
      isActivated,
      activationDate,
    } = record
    return (
      <div key={quest.id} className="ledger-quest-row-wrap">
        <button
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
              <HabitMomentumBadge signal={momentum} profile={profileId} compact />
            </span>
            <span className="mt-1 block text-xs text-muted">
              {formatQuestCadence(quest)}
              {isGraduated
                ? ' · Bloomed'
                : isLegacy
                  ? ' · Earlier chapter'
                  : isPaused
                    ? ' · Paused'
                    : isArchived
                      ? ' · Archived'
                      : ''}
            </span>
            <span className="mt-2 flex min-h-2 items-center gap-1" aria-hidden="true">
              {recent?.periods.slice(-6).map((period) => (
                <span key={period.periodKey} className="ledger-recent-mark" data-status={period.status} />
              ))}
            </span>
            <span className="sr-only">
              {isLocked
                ? `Unlocks at level ${quest.minLevel}. Open task preview.`
                : !isActivated
                  ? activationDate
                    ? `Starts on ${activationDate}. Open task preview.`
                    : 'Available to add from Today. Open task preview.'
                : `${recent?.completedPeriods ?? stat?.completed ?? 0} of ${recent?.decidedPeriods ?? stat?.shown ?? 0} recent targets met. Open task history.`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted">
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
              {isLocked
                ? `Level ${quest.minLevel}`
                : !isActivated
                  ? activationDate
                    ? 'Starts next day'
                    : 'Available'
                : recent?.decidedPeriods
                  ? `${recent.successRate}% · 30D`
                  : isPaused
                    ? 'Paused'
                    : isGraduated
                      ? 'Bloomed'
                      : isLegacy
                        ? 'History'
                        : isArchived
                          ? 'Archived'
                          : 'In progress'}
            </span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </button>
        {allowRestore ? (
          <div className="ledger-archived-actions">
            {onRestoreHabit ? (
              <button type="button" onClick={() => onRestoreHabit(quest.id)} className="ledger-restore-button">
                Restore
              </button>
            ) : null}
            {onDeleteHabit ? (
              <button
                type="button"
                onClick={() => {
                  const confirmation = window.prompt(
                    `This permanently deletes every record and removes earned points. Export your CSV first if you want a copy.\n\nType "${quest.title}" to delete.`,
                  )
                  if (confirmation?.trim() === quest.title.trim()) {
                    onDeleteHabit(quest.id)
                  }
                }}
                className="ledger-delete-button"
              >
                Delete permanently
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const renderActivityRecord = (
    record: (typeof activityRecords)[number],
    allowRestore = false,
  ) => {
    const { activity, recent, history, isArchived, isPaused } = record
    const totalLabel =
      activity.kind === 'check'
        ? `${history?.activeDays ?? 0} active ${history?.activeDays === 1 ? 'day' : 'days'}`
        : activity.kind === 'rating'
          ? `${formatOpenAmount(history?.averagePerActiveDay ?? 0, 1)} / 5 average`
        : `${formatOpenAmount(history?.total ?? 0)}${activity.unit ? ` ${activity.unit}` : ''}`
    const lastLogged = history?.lastLoggedDate
      ? history.lastLoggedDate === game.currentDate
        ? 'Today'
        : formatShortDate(history.lastLoggedDate)
      : 'Not yet'
    const peak = activity.kind === 'rating'
      ? 5
      : Math.max(1, recent?.peakCount ?? 0)

    return (
      <div key={activity.id} className="ledger-quest-row-wrap">
        <button
          type="button"
          onClick={() => onOpenQuest(activity.id)}
          className="habit-ledger-card ledger-quest-row w-full rounded-card border border-border bg-surface p-4 text-left shadow-sm"
        >
          <span className="flex items-start gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-full text-2xl"
              style={{
                backgroundColor: `${activity.color}18`,
                boxShadow: `inset 0 0 0 1px ${activity.color}55`,
              }}
              aria-hidden="true"
            >
              {activity.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="block text-base font-semibold text-ink">
                    {activity.title}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-[color:var(--ledger-secondary)]">
                    {totalLabel}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {activity.kind === 'count'
                      ? `${history?.activeDays ?? 0} active ${(history?.activeDays ?? 0) === 1 ? 'day' : 'days'} · `
                      : activity.kind === 'rating'
                        ? `${history?.activeDays ?? 0} ${(history?.activeDays ?? 0) === 1 ? 'day rated' : 'days rated'} · `
                      : ''}
                    Last logged {lastLogged}
                    {isPaused ? ' · Paused' : isArchived ? ' · Archived' : ''}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
              </span>
            </span>
          </span>

          {activity.kind === 'check' ? (
            <span
              className="ledger-open-activity-strip mt-4 flex flex-wrap items-center gap-1.5"
              role="img"
              aria-label={getOpenActivityStripLabel(recent?.days ?? [], activity.kind, activity.unit)}
            >
              {(recent?.days ?? []).map((day) => (
                <span
                  key={day.dateKey}
                  className="size-3.5 shrink-0 rounded-full border"
                  style={{
                    borderColor: day.active ? activity.color : `${activity.color}66`,
                    backgroundColor: day.active ? activity.color : 'transparent',
                  }}
                  aria-hidden="true"
                />
              ))}
            </span>
          ) : (
            <span
              className="mt-4 flex h-12 items-end gap-1.5"
              role="img"
              aria-label={getOpenActivityStripLabel(recent?.days ?? [], activity.kind, activity.unit)}
            >
              {(recent?.days ?? []).map((day) => (
                <span
                  key={day.dateKey}
                  className="min-h-px flex-1 rounded-t-sm"
                  style={{
                    height: day.count ? `${Math.max(12, (day.count / peak) * 100)}%` : '1px',
                    backgroundColor: day.count ? activity.color : `${activity.color}33`,
                  }}
                  aria-hidden="true"
                />
              ))}
            </span>
          )}
          <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            {recent?.days.length ?? 0}-day view · Blank days are neutral
          </span>
        </button>

        {allowRestore ? (
          <div className="ledger-archived-actions">
            {onRestoreHabit ? (
              <button type="button" onClick={() => onRestoreHabit(activity.id)} className="ledger-restore-button">
                Restore
              </button>
            ) : null}
            {onDeleteHabit ? (
              <button
                type="button"
                onClick={() => {
                  const confirmation = window.prompt(
                    `This permanently deletes this anytime record and all of its logged history. Export your data first if you want a copy.\n\nType "${activity.title}" to delete.`,
                  )
                  if (confirmation?.trim() === activity.title.trim()) {
                    onDeleteHabit(activity.id)
                  }
                }}
                className="ledger-delete-button"
              >
                Delete permanently
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

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
      </header>

      <section className="relative z-10 mt-5" aria-label="Daily emotion record">
        <button
          type="button"
          onClick={onOpenEmotion}
          className="habit-ledger-card ledger-quest-row emotion-ledger-entry flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-sm"
          aria-label={`Open emotion history. ${emotionRecordCount} ${emotionRecordCount === 1 ? 'day' : 'days'} recorded.${currentEmotion ? ` Today's emotion is ${DAILY_EMOTION_LABELS[currentEmotion]}.` : " Today's emotion is not set."}`}
        >
          <span className="emotion-ledger-emblem grid size-12 shrink-0 place-items-center rounded-full" aria-hidden="true">
            <EmotionFaceIcon
              emotion={currentEmotion ?? 'okay'}
              profile={profileId}
              className="size-10"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-ink">
              Emotion history
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">
              {emotionRecordCount} {emotionRecordCount === 1 ? 'day' : 'days'} recorded · Blank days stay neutral
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted">
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
              {currentEmotion ? DAILY_EMOTION_LABELS[currentEmotion] : 'View'}
            </span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </button>
      </section>

      {activityRecords.length ? (
        <section
          className="relative z-10 mt-8"
          aria-labelledby={`${profileId}-anytime-records-heading`}
        >
          <div className="px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              {isCramble ? 'Field notes' : 'Garden notes'}
            </p>
            <h2
              id={`${profileId}-anytime-records-heading`}
              className="mt-1 text-xl font-semibold text-ink"
            >
              Anytime records
            </h2>
            <div className="section-sigil-divider" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {currentActivityRecords.map((record) =>
              renderActivityRecord(record),
            )}
            {archivedActivityRecords.length ? (
              <details className="ledger-record-group">
                <summary>
                  Archived anytime records{' '}
                  <span>{archivedActivityRecords.length}</span>
                </summary>
                <p className="mt-2 text-xs leading-5 text-faint">
                  Their factual history stays available and never affects quest
                  scores.
                </p>
                <div className="mt-3 space-y-3">
                  {archivedActivityRecords.map((record) =>
                    renderActivityRecord(record, true),
                  )}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

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
          <div className="section-sigil-divider" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {questRecords.length ? (
            <>
              <h3 className="ledger-group-heading">
                Active &amp; attempted <span>{currentRecords.length}</span>
              </h3>
              {currentRecords.map((record) => renderQuestRecord(record))}

              {pausedRecords.length ? (
                <details className="ledger-record-group" open>
                  <summary>
                    Paused habits <span>{pausedRecords.length}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-faint">
                    These periods are neutral and create no backlog.
                  </p>
                  <div className="mt-3 space-y-3">
                    {pausedRecords.map((record) => renderQuestRecord(record))}
                  </div>
                </details>
              ) : null}

              {graduatedRecords.length ? (
                <details className="ledger-record-group" open>
                  <summary>
                    {isCramble ? 'Mastered chapters' : 'Bloomed skills'}{' '}
                    <span>{graduatedRecords.length}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-faint">
                    These quests finished their chapter and left Today. Their
                    history and earned rewards remain.
                  </p>
                  <div className="mt-3 space-y-3">
                    {graduatedRecords.map((record) =>
                      renderQuestRecord(record, true),
                    )}
                  </div>
                </details>
              ) : null}

              {legacyRecords.length ? (
                <details className="ledger-record-group">
                  <summary>
                    Earlier chapters <span>{legacyRecords.length}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-faint">
                    Cleaned-up quests stay here so their records and rewards
                    keep their original meaning.
                  </p>
                  <div className="mt-3 space-y-3">
                    {legacyRecords.map((record) => renderQuestRecord(record))}
                  </div>
                </details>
              ) : null}

              {archivedRecords.length ? (
                <details className="ledger-record-group" open>
                  <summary>
                    Archived habits <span>{archivedRecords.length}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-faint">
                    History and earned rewards remain. Restore one whenever it fits again.
                  </p>
                  <div className="mt-3 space-y-3">
                    {archivedRecords.map((record) => renderQuestRecord(record, true))}
                  </div>
                </details>
              ) : null}

              {futureRecords.length ? (
                <details className="ledger-record-group">
                  <summary>
                    Future quests <span>{futureRecords.length}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-faint">
                    Unlocking only makes a quest available. Add it from Today
                    whenever it feels right; it creates no earlier misses.
                  </p>
                  <div className="mt-3 space-y-3">
                    {futureRecords.map((record) => renderQuestRecord(record))}
                  </div>
                </details>
              ) : null}
            </>
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

function formatShortDate(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatOpenAmount(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value)
}

function getOpenActivityStripLabel(
  days: Array<{ dateKey: string; count: number; active: boolean }>,
  kind: OpenActivityKind,
  unit?: string | null,
) {
  if (!days.length) return 'No activity days are available in this view. Blank days are neutral.'
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const activeDays = days.filter((day) => day.active).length
  const range = `${formatShortDate(days[0].dateKey)} through ${formatShortDate(days.at(-1)!.dateKey)}`
  return kind === 'check'
    ? `${range}. Logged on ${activeDays} of ${days.length} days. Unlogged days are neutral.`
    : kind === 'rating'
      ? `${range}. Rated on ${activeDays} of ${days.length} days, averaging ${activeDays ? (total / activeDays).toFixed(1) : '0'} out of 5. Unrated days are neutral.`
    : `${range}. ${formatOpenAmount(total)}${unit ? ` ${unit}` : ' total'} across ${activeDays} active days. Unlogged days are neutral.`
}
