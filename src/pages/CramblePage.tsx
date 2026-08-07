import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  Compass,
  Flame,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Sword,
} from 'lucide-react'
import { useState } from 'react'
import { AddHabitDialog } from '@/components/AddHabitDialog'
import { BackfillDialog } from '@/components/BackfillDialog'
import { PauseTrackingDialog } from '@/components/PauseTrackingDialog'
import { QuestSection } from '@/components/QuestSection'
import {
  PausedHabitsCard,
  ProfilePauseBanner,
  TodayProgressCard,
  TodayUtilityActions,
} from '@/components/TodayHabitControls'
import { SunMark } from '@/components/icons/SunMark'
import crambleChronicles from '@/data/crambleChronicles.json'
import { crambleQuests } from '@/data/crambleQuests'
import {
  getCrambleChapterProgress,
  getCrambleJourneyProgress,
} from '@/lib/crambleGame'
import {
  habitInputFromQuest,
  type NewHabitInput,
} from '@/lib/customHabits'
import {
  getActiveHabitPause,
  getActiveProfilePause,
  getHabitSettings,
  hasHabitHistory,
  isHabitArchivedOnDate,
  type PauseInput,
} from '@/lib/habitLifecycle'
import { downloadProfileCsv } from '@/lib/habitExport'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import {
  displayDate,
  getLevelProgress,
  getQuestCatalog,
  getLongTermCheckedIds,
  getLongTermQuestStatus,
  getQuestScheduleProgress,
  getSkippedIdsForState,
  getSkipProgress,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import type { HanaGameState } from '@/types'
import {
  getHabitMomentumSignal,
  getHabitRangeStats,
} from '@/lib/hanaStats'

export type CrambleSyncStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'conflict'
  | 'offline'
  | 'disabled'

type ChronicleLine = {
  id: string
  text: string
}

type Props = {
  game: HanaGameState
  onToggle: (id: string) => void
  onUndoOccurrence: (id: string) => void
  onAddHabit: (input: NewHabitInput) => string | null
  onEditHabit: (habitId: string, input: NewHabitInput) => string | null
  onPauseHabit: (habitId: string, input: PauseInput) => void
  onResumeHabit: (habitId: string) => void
  onArchiveHabit: (habitId: string) => void
  onRestoreHabit: (habitId: string) => void
  onDeleteHabit: (habitId: string) => void
  onPauseTracking: (input: PauseInput) => void
  onResumeTracking: () => void
  onBackfill: (dateKey: string, habitId: string) => string | null
  onUndoBackfill: (dateKey: string, habitId: string) => string | null
  onSkip: (id: string) => void
  onOpenObservatory: () => void
  onOpenLedger: () => void
  onNextDay: () => void
  onReset: () => void
  onSyncCloud: () => void
  cloudSyncStatus: CrambleSyncStatus
  lastCloudSyncAt: string | null
  onBack: () => void
}

const chronicleLines = crambleChronicles as ChronicleLine[]

export function CramblePage({
  game,
  onToggle,
  onUndoOccurrence,
  onAddHabit,
  onEditHabit,
  onPauseHabit,
  onResumeHabit,
  onArchiveHabit,
  onRestoreHabit,
  onDeleteHabit,
  onPauseTracking,
  onResumeTracking,
  onBackfill,
  onUndoBackfill,
  onSkip,
  onOpenObservatory,
  onOpenLedger,
  onNextDay,
  onReset,
  onSyncCloud,
  cloudSyncStatus,
  lastCloudSyncAt,
  onBack,
}: Props) {
  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false)
  const [managedHabitId, setManagedHabitId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [isPauseTrackingOpen, setIsPauseTrackingOpen] = useState(false)
  const [isBackfillOpen, setIsBackfillOpen] = useState(false)
  const headingRef = usePageHeadingFocus()
  const catalog = getQuestCatalog(crambleQuests, game)
  const levelProgress = getLevelProgress(game.totalFlowers)
  const chapter = getCrambleChapterProgress(game)
  const journey = getCrambleJourneyProgress(game)
  const visibleQuests = visibleQuestsForState(catalog, game)
  const momentumById = Object.fromEntries(
    catalog.map((quest) => {
      const history = getHabitRangeStats(
        game,
        crambleQuests,
        'cramble',
        quest.id,
        'all',
      )
      return [
        quest.id,
        history ? getHabitMomentumSignal(history, 'cramble') : null,
      ]
    }),
  )
  const dailyProgressById = Object.fromEntries(
    visibleQuests.daily.map((quest) => [
      quest.id,
      getQuestScheduleProgress(game, quest),
    ]),
  )
  const dailyCheckedIds = visibleQuests.daily.reduce<Record<string, boolean>>(
    (result, quest) => {
      result[quest.id] =
        quest.schedule?.kind === 'periodTarget'
          ? dailyProgressById[quest.id].isComplete
          : Boolean(game.dailyCompletions[game.currentDate]?.[quest.id])
      return result
    },
    {},
  )
  const periodProgressById = Object.fromEntries(
    visibleQuests.daily
      .filter((quest) => quest.schedule?.kind === 'periodTarget')
      .map((quest) => [quest.id, dailyProgressById[quest.id]]),
  )
  const longTermCheckedIds = getLongTermCheckedIds(game)
  const skippedIds = getSkippedIdsForState(catalog, game)
  const skipProgress = getSkipProgress(game)
  const activeProfilePause = getActiveProfilePause(game)
  const pausedHabits = catalog.filter(
    (quest) =>
      !isHabitArchivedOnDate(game, quest.id) &&
      Boolean(getActiveHabitPause(game, quest.id)),
  )
  const managedQuest = catalog.find((habit) => habit.id === managedHabitId)
  const cueById = Object.fromEntries(
    catalog.map((quest) => [quest.id, getHabitSettings(game, quest.id).cue]),
  )
  const todayTotal = visibleQuests.daily.length + visibleQuests.longTerm.length
  const todayComplete =
    Object.values(dailyCheckedIds).filter(Boolean).length +
    Object.values(longTermCheckedIds).filter(Boolean).length
  const line = getChronicleLine(game.currentDate)
  const showDevControls = import.meta.env.DEV
  const dailyMetaById = visibleQuests.daily.reduce<Record<string, string>>(
    (result, quest) => {
      const label = dailyProgressById[quest.id].label
      if (label || quest.custom) {
        result[quest.id] = label ?? 'Daily'
      }
      return result
    },
    {},
  )
  const longTermMetaById = Object.fromEntries(
    visibleQuests.longTerm.map((quest) => [
      quest.id,
      getLongTermQuestStatus(game, quest).label,
    ]),
  )

  const resetWithConfirmation = () => {
    if (window.confirm("Reset Cramble's renown and recorded quests?")) {
      onReset()
    }
  }

  return (
    <div
      className="cramble-archive-shell mx-auto min-h-full w-full max-w-md px-5 pb-8 pt-6"
      aria-busy={cloudSyncStatus === 'loading' || cloudSyncStatus === 'syncing'}
    >
      <div className="cramble-decor-layer" aria-hidden="true" />

      <div className="relative z-10 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Lock Cramble's tracker and return home"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm outline-none transition active:scale-95 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <SunMark className="size-4 text-[color:var(--cramble-brass)]" />
          Cramble
        </span>
      </div>

      <header className="relative z-10 mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
          The Sunward Archive · Chapter {chapter.chapterNumber}
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-semibold tracking-tight text-ink outline-none"
            >
              {chapter.isComplete ? 'The oath is fulfilled' : "Today's chapter"}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="size-4" aria-hidden="true" />
              {displayDate(game.currentDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncCloud}
            disabled={
              cloudSyncStatus === 'loading' ||
              cloudSyncStatus === 'syncing' ||
              cloudSyncStatus === 'disabled'
            }
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm outline-none transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
            aria-label="Refresh Cramble's progress from database"
          >
            <RefreshCw
              className={`size-3.5 ${
                cloudSyncStatus === 'loading' || cloudSyncStatus === 'syncing'
                  ? 'animate-spin motion-reduce:animate-none'
                  : ''
              }`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
        <p
          className="mt-3 text-xs text-faint"
          role="status"
          aria-live="polite"
        >
          {getSyncLabel(cloudSyncStatus, lastCloudSyncAt)}
        </p>
      </header>

      <TodayProgressCard
        profile="cramble"
        complete={todayComplete}
        total={todayTotal}
      />
      {activeProfilePause ? (
        <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
      ) : null}
      <TodayUtilityActions
        isPaused={Boolean(activeProfilePause)}
        onPause={() => setIsPauseTrackingOpen(true)}
        onBackfill={() => setIsBackfillOpen(true)}
        onExport={() => downloadProfileCsv(game, crambleQuests, 'cramble')}
      />

      {!activeProfilePause ? (
        <main className="relative z-10 mt-6 space-y-8">
          <QuestSection
            title="Daily Lessons"
            quests={visibleQuests.daily}
            checkedIds={dailyCheckedIds}
            skippedIds={skippedIds}
            canSkip={skipProgress.remaining > 0}
            metaById={dailyMetaById}
            periodProgressById={periodProgressById}
            momentumById={momentumById}
            cueById={cueById}
            onManage={setManagedHabitId}
            variant="archive"
            rewardSingular="renown"
            rewardPlural="renown"
            completionVerb="recorded"
            skipLabel="Pass"
            skippedLabel="Passed"
            onToggle={onToggle}
            onUndoOccurrence={onUndoOccurrence}
            onSkip={onSkip}
          />
          {visibleQuests.longTerm.length > 0 ? (
            <QuestSection
              title="Long Studies"
              quests={visibleQuests.longTerm}
              checkedIds={longTermCheckedIds}
              skippedIds={skippedIds}
              canSkip={skipProgress.remaining > 0}
              metaById={longTermMetaById}
              momentumById={momentumById}
              cueById={cueById}
              onManage={setManagedHabitId}
              variant="archive"
              rewardSingular="renown"
              rewardPlural="renown"
              completionVerb="recorded"
              skipLabel="Pass"
              skippedLabel="Passed"
              onToggle={onToggle}
              onSkip={onSkip}
            />
          ) : null}
        </main>
      ) : null}

      <PausedHabitsCard
        habits={pausedHabits}
        onResume={onResumeHabit}
        onManage={setManagedHabitId}
      />

      <section className="cramble-codex-card relative z-10 mb-5 rounded-card border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-faint">
            From the archive
          </p>
          <ForgeMark />
        </div>
        <blockquote className="mt-2 text-sm leading-6 text-ink">
          “{line.text}”
        </blockquote>
        <p className="mt-2 text-xs font-medium text-muted">The Sunward Archive</p>
      </section>

      <section className="cramble-codex-card relative z-10 mb-8 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Renown recorded</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">
              {game.totalFlowers}
            </p>
          </div>
          <div className="cramble-compass-medallion grid size-14 place-items-center rounded-full">
            <Compass className="size-7" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs font-medium text-muted">
            <span>Rank {levelProgress.level}</span>
            <span>
              {levelProgress.collectedThisLevel}/{levelProgress.neededThisLevel}{' '}
              renown
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="cramble-renown-fill h-full rounded-full transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${levelProgress.percent}%` }}
              role="progressbar"
              aria-label={`Progress through rank ${levelProgress.level}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={levelProgress.percent}
            />
          </div>
          <p className="mt-2 text-xs text-faint">
            Finished lessons and completed period goals add to Cramble's renown.
          </p>
        </div>

        <ObservatoryPreview
          renown={game.totalFlowers}
          percent={journey.percent}
          onOpen={onOpenObservatory}
        />
      </section>

      <main className="relative z-10 mt-8 space-y-8">
        <div className="cramble-codex-card rounded-card border border-border bg-surface p-4 text-sm text-muted shadow-sm">
          <span className="font-medium text-ink">Weekly passes:</span>{' '}
          {skipProgress.remaining}/{skipProgress.limit} left
          <p className="mt-1 text-xs text-faint">
            Passes renew every Sunday. A pass earns no renown, but it never
            breaks your progress.
          </p>
        </div>
      </main>

      <section className="cramble-chapter-card relative z-10 mt-10 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
              Chapter {chapter.chapterNumber}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
              {chapter.title}
            </h2>
          </div>
          <span className="rounded-full border border-border bg-surface/85 px-3 py-1 text-xs font-semibold tabular-nums text-ink">
            {chapter.percent}%
          </span>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="cramble-renown-fill h-full rounded-full transition-all duration-200 motion-reduce:transition-none"
            style={{ width: `${chapter.percent}%` }}
            role="progressbar"
            aria-label={`${chapter.title} chapter progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={chapter.percent}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-control border border-border bg-surface/70 p-3">
            <p className="text-xs font-medium text-faint">Archive rank</p>
            <p className="mt-1 font-semibold text-ink">
              {Math.min(levelProgress.level, chapter.targetLevel)}/{chapter.targetLevel}
            </p>
          </div>
          <div className="rounded-control border border-border bg-surface/70 p-3">
            <p className="text-xs font-medium text-faint">Renown</p>
            <p className="mt-1 font-semibold text-ink">
              {Math.min(game.totalFlowers, chapter.targetRenown)}/{chapter.targetRenown}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">
          {chapter.isComplete
            ? `${chapter.nextChapter} now waits beyond the archive doors.`
            : `${chapter.renownRemaining} more renown remains in this first, gentle oath.`}
        </p>
      </section>

      {showDevControls ? (
        <section className="relative z-10 mt-10 rounded-card border border-dashed border-border bg-surface/75 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Dev testing
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onNextDay}
              className="cramble-primary-button rounded-control px-4 py-3 text-sm font-medium shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Next day
            </button>
            <button
              type="button"
              onClick={resetWithConfirmation}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-3 text-sm font-medium text-muted shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </button>
          </div>
        </section>
      ) : null}

      <div className="cramble-action-bar">
        <button
          type="button"
          onClick={() => setIsAddHabitOpen(true)}
          className="habit-add-button"
          aria-label="Add a habit for Cramble"
        >
          <span className="habit-add-icon" aria-hidden="true">
            <Plus className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Add habit</span>
            <span className="block text-xs opacity-75">
              Choose its rhythm and period reward
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenObservatory}
          className="cramble-action-button"
        >
          <span className="cramble-action-icon" aria-hidden="true">
            <Star className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">
              Open the Observatory
            </span>
            <span className="block text-xs text-muted">
              {journey.percent}% of the Sunward Road crossed
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenLedger}
          className="cramble-action-button"
        >
          <span className="cramble-action-icon" aria-hidden="true">
            <BarChart3 className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">
              View the Ledger
            </span>
            <span className="block text-xs text-muted">
              Read the rhythm of recent chapters
            </span>
          </span>
        </button>
      </div>

      {isAddHabitOpen ? (
        <AddHabitDialog
          profile="cramble"
          existingTitles={catalog.map((quest) => quest.title)}
          onClose={() => setIsAddHabitOpen(false)}
          onSubmit={onAddHabit}
        />
      ) : null}
      {managedQuest ? (
        <AddHabitDialog
          profile="cramble"
          mode="edit"
          initialValue={habitInputFromQuest(managedQuest, {
            cue: getHabitSettings(game, managedQuest.id).cue,
            reminderTime: getHabitSettings(game, managedQuest.id).reminder.time,
          })}
          rulesLocked={!managedQuest.custom || hasHabitHistory(game, managedQuest.id)}
          contentLocked={false}
          lifecycleStatus={
            isHabitArchivedOnDate(game, managedQuest.id)
              ? 'archived'
              : getActiveHabitPause(game, managedQuest.id)
                ? 'paused'
                : 'active'
          }
          existingTitles={catalog
            .filter((quest) => quest.id !== managedQuest.id)
            .map((quest) => quest.title)}
          onClose={() => setManagedHabitId(null)}
          onSubmit={(input) => onEditHabit(managedQuest.id, input)}
          onRequestPause={() => setPauseHabitId(managedQuest.id)}
          onResume={() => onResumeHabit(managedQuest.id)}
          onArchive={() => onArchiveHabit(managedQuest.id)}
          onRestore={() => onRestoreHabit(managedQuest.id)}
          onDelete={() => onDeleteHabit(managedQuest.id)}
        />
      ) : null}
      {isPauseTrackingOpen ? (
        <PauseTrackingDialog
          profile="cramble"
          currentDate={game.currentDate}
          onClose={() => setIsPauseTrackingOpen(false)}
          onSubmit={onPauseTracking}
        />
      ) : null}
      {pauseHabitId ? (
        <PauseTrackingDialog
          profile="cramble"
          currentDate={game.currentDate}
          habitTitle={catalog.find((quest) => quest.id === pauseHabitId)?.title}
          onClose={() => setPauseHabitId(null)}
          onSubmit={(input) => onPauseHabit(pauseHabitId, input)}
        />
      ) : null}
      {isBackfillOpen ? (
        <BackfillDialog
          profile="cramble"
          game={game}
          baseQuests={crambleQuests}
          onClose={() => setIsBackfillOpen(false)}
          onRecord={onBackfill}
          onUndo={onUndoBackfill}
        />
      ) : null}
    </div>
  )
}

function ForgeMark() {
  return (
    <span className="cramble-forge-mark" aria-hidden="true">
      <Sword className="cramble-forge-sword" />
      <Flame className="cramble-forge-flame" />
      <span className="cramble-forge-spark cramble-forge-spark-one" />
      <span className="cramble-forge-spark cramble-forge-spark-two" />
    </span>
  )
}

function ObservatoryPreview({
  renown,
  percent,
  onOpen,
}: {
  renown: number
  percent: number
  onOpen: () => void
}) {
  const journeyRatio = Math.min(100, Math.max(0, percent)) / 100
  const knightLeft = 36 + journeyRatio * 48
  const knightBottom = 0.3 + journeyRatio * 1.15
  const knightScale = 1 - journeyRatio * 0.38

  return (
    <button
      type="button"
      onClick={onOpen}
      className="cramble-observatory-preview mt-5 flex w-full items-center gap-4 text-left transition active:scale-[0.98] focus-visible:outline-none motion-reduce:transition-none"
    >
      <span className="cramble-mini-journey" aria-hidden="true">
        <span className="cramble-mini-journey-road" />
        <span className="cramble-mini-journey-fire" />
        <span className="cramble-mini-journey-person cramble-mini-journey-woman" />
        <span
          className="cramble-mini-journey-person cramble-mini-journey-knight"
          style={{
            left: `${knightLeft}%`,
            bottom: `${knightBottom}rem`,
            transform: `translateX(-50%) scale(${knightScale})`,
          }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">
          Lantern Observatory
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-white/70">
          {renown === 0
            ? 'The first road is waiting for one useful lesson.'
            : `${percent}% of the Sunward Road is open.`}
        </span>
      </span>
    </button>
  )
}

function getChronicleLine(dateKey: string) {
  const index =
    dateKey.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    chronicleLines.length
  return chronicleLines[index]
}

function getSyncLabel(
  status: CrambleSyncStatus,
  lastCloudSyncAt: string | null,
) {
  if (status === 'disabled') return 'Local development uses Cramble’s separate device cache.'
  if (status === 'loading') return 'Opening the latest chronicle from the database...'
  if (status === 'syncing') return 'Recording the newest page in the database...'
  if (status === 'error') return 'The database could not record this page. Refresh will retry it first.'
  if (status === 'conflict') return 'A newer chronicle exists. Press sync to back up this copy and load it safely.'
  if (status === 'offline') return 'Offline. Showing Cramble’s saved cache for now.'
  if (status === 'synced' && lastCloudSyncAt) {
    return `Chronicle synchronized ${formatSyncTime(lastCloudSyncAt)}.`
  }
  return 'Cramble’s database record is separate from Hana’s garden.'
}

function formatSyncTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
