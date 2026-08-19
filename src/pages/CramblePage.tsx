import {
  BarChart3,
  CalendarDays,
  Flame,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Sword,
} from 'lucide-react'
import { useState } from 'react'
import { AddHabitDialog } from '@/components/AddHabitDialog'
import { AddAnytimeLogDialog } from '@/components/AddAnytimeLogDialog'
import { AnytimeLogSection } from '@/components/AnytimeLogSection'
import { DailyEmotionPicker } from '@/components/DailyEmotionPicker'
import { BackfillDialog } from '@/components/BackfillDialog'
import { ExportDataDialog } from '@/components/ExportDataDialog'
import { PauseTrackingDialog } from '@/components/PauseTrackingDialog'
import { CloudSyncNotice } from '@/components/CloudSyncNotice'
import { ProfileTopBar } from '@/components/ProfileTopBar'
import {
  PausedHabitsCard,
  ProfilePauseBanner,
  TodayUtilityActions,
} from '@/components/TodayHabitControls'
import crambleChronicles from '@/data/crambleChronicles.json'
import { crambleQuests } from '@/data/crambleQuests'
import {
  getCrambleChapterProgress,
  getCrambleJourneyProgress,
} from '@/lib/crambleGame'
import { type NewHabitInput } from '@/lib/customHabits'
import {
  getActiveHabitPause,
  getActiveProfilePause,
  isHabitArchivedOnDate,
  type PauseInput,
} from '@/lib/habitLifecycle'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import {
  displayDate,
  getQuestCatalog,
} from '@/lib/hanaGame'
import type {
  DailyEmotion,
  HanaGameState,
  NewOpenActivityInput,
} from '@/types'
import {
  getOpenActivityCatalog,
  hasOpenActivityHistory,
} from '@/lib/openActivities'
import { downloadProfileJson } from '@/lib/habitExport'

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
  onAddHabit: (input: NewHabitInput) => string | null
  onAddOpenActivity: (input: NewOpenActivityInput) => string | null
  onEditOpenActivity: (
    activityId: string,
    input: NewOpenActivityInput,
  ) => string | null
  onIncrementOpenActivity: (activityId: string) => void
  onDecrementOpenActivity: (activityId: string) => void
  onSetOpenActivityRating: (activityId: string, rating: number) => void
  onSetDailyEmotion: (emotion: DailyEmotion) => void
  onPauseHabit: (habitId: string, input: PauseInput) => void
  onResumeHabit: (habitId: string) => void
  onArchiveHabit: (habitId: string) => void
  onRestoreHabit: (habitId: string) => void
  onDeleteHabit: (habitId: string) => void
  onPauseTracking: (input: PauseInput) => void
  onResumeTracking: () => void
  onBackfill: (dateKey: string, habitId: string) => string | null
  onUndoBackfill: (dateKey: string, habitId: string) => string | null
  onBackfillOpenActivity: (
    dateKey: string,
    activityId: string,
  ) => string | null
  onUndoBackfillOpenActivity: (
    dateKey: string,
    activityId: string,
  ) => string | null
  onOpenObservatory: () => void
  onOpenLedger: () => void
  onNextDay: () => void
  onReset: () => void
  onSyncCloud: () => void
  cloudSyncStatus: CrambleSyncStatus
  lastCloudSyncAt: string | null
  hasPendingCloudSave: boolean
  saveConfirmedAt: number | null
  onBack: () => void
}

const chronicleLines = crambleChronicles as ChronicleLine[]

export function CramblePage({
  game,
  onAddHabit,
  onAddOpenActivity,
  onEditOpenActivity,
  onIncrementOpenActivity,
  onDecrementOpenActivity,
  onSetOpenActivityRating,
  onSetDailyEmotion,
  onPauseHabit,
  onResumeHabit,
  onArchiveHabit,
  onRestoreHabit,
  onDeleteHabit,
  onPauseTracking,
  onResumeTracking,
  onBackfill,
  onUndoBackfill,
  onBackfillOpenActivity,
  onUndoBackfillOpenActivity,
  onOpenObservatory,
  onOpenLedger,
  onNextDay,
  onReset,
  onSyncCloud,
  cloudSyncStatus,
  lastCloudSyncAt,
  hasPendingCloudSave,
  saveConfirmedAt,
  onBack,
}: Props) {
  const [addDialogInitialView, setAddDialogInitialView] = useState<
    'chooser' | 'anytime' | null
  >(null)
  const [isScheduledHabitOpen, setIsScheduledHabitOpen] = useState(false)
  const [managedActivityId, setManagedActivityId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [isPauseTrackingOpen, setIsPauseTrackingOpen] = useState(false)
  const [isBackfillOpen, setIsBackfillOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const headingRef = usePageHeadingFocus()
  const catalog = getQuestCatalog(crambleQuests, game)
  const openActivities = getOpenActivityCatalog(game)
  const chapter = getCrambleChapterProgress(game)
  const journey = getCrambleJourneyProgress(game)
  const activeProfilePause = getActiveProfilePause(game)
  const pausedOpenActivities = openActivities.filter(
    (activity) =>
      !isHabitArchivedOnDate(game, activity.id) &&
      Boolean(getActiveHabitPause(game, activity.id)),
  )
  const activeOpenActivities = openActivities.filter(
    (activity) =>
      !isHabitArchivedOnDate(game, activity.id) &&
      !getActiveHabitPause(game, activity.id),
  )
  const managedActivity = openActivities.find(
    (activity) => activity.id === managedActivityId,
  )
  const allTrackerTitles = [
    ...catalog.map((quest) => quest.title),
    ...openActivities.map((activity) => activity.title),
  ]
  const line = getChronicleLine(game.currentDate)
  const showDevControls = import.meta.env.DEV
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

      <ProfileTopBar profile="cramble" onBack={onBack} />

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

      <DailyEmotionPicker
        profile="cramble"
        value={game.dailyEmotions[game.currentDate] ?? null}
        disabled={Boolean(activeProfilePause)}
        onChange={onSetDailyEmotion}
      />

      {activeProfilePause ? (
        <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
      ) : null}
      <AnytimeLogSection
        profile="cramble"
        activities={activeOpenActivities}
        todayCounts={game.openActivityLogs[game.currentDate] ?? {}}
        disabled={Boolean(activeProfilePause)}
        onIncrement={onIncrementOpenActivity}
        onDecrement={onDecrementOpenActivity}
        onSetRating={onSetOpenActivityRating}
        onManage={setManagedActivityId}
        onAdd={() => setAddDialogInitialView('anytime')}
      />
      <PausedHabitsCard
        habits={pausedOpenActivities}
        title="Paused field logs"
        onResume={onResumeHabit}
        onManage={setManagedActivityId}
      />

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

      <TodayUtilityActions
        isPaused={Boolean(activeProfilePause)}
        onPause={() => setIsPauseTrackingOpen(true)}
        onBackfill={() => setIsBackfillOpen(true)}
        onExport={() => setIsExportOpen(true)}
      />

      <CloudSyncNotice
        profile="cramble"
        status={cloudSyncStatus}
        hasPendingSave={hasPendingCloudSave}
        saveConfirmedAt={saveConfirmedAt}
        onRetry={onSyncCloud}
        onExportBackup={() =>
          downloadProfileJson(game, crambleQuests, 'cramble')
        }
      />

      <nav
        className="profile-action-bar profile-action-bar-cramble"
        aria-label="Cramble actions"
      >
        <button
          type="button"
          onClick={() => setAddDialogInitialView('chooser')}
          className="habit-add-button"
          aria-label="Add a habit for Cramble"
        >
          <span className="habit-add-icon" aria-hidden="true">
            <Plus className="size-5" />
          </span>
          <span className="profile-action-copy">
            <span className="profile-action-label">Add habit</span>
            <span className="profile-action-detail">
              Add a scheduled habit or anytime log
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenObservatory}
          className="profile-action-button"
          aria-label={`Open the Observatory. ${journey.percent}% of the Sunward Road crossed`}
        >
          <span className="cramble-action-icon" aria-hidden="true">
            <Star className="size-4" />
          </span>
          <span className="profile-action-copy">
            <span className="profile-action-label">Observatory</span>
            <span className="profile-action-detail">
              {journey.percent}% of the Sunward Road crossed
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenLedger}
          className="profile-action-button"
          aria-label="View the Ledger and read the rhythm of recent chapters"
        >
          <span className="cramble-action-icon" aria-hidden="true">
            <BarChart3 className="size-4" />
          </span>
          <span className="profile-action-copy">
            <span className="profile-action-label">Ledger</span>
            <span className="profile-action-detail">
              Read the rhythm of recent chapters
            </span>
          </span>
        </button>
      </nav>

      {addDialogInitialView ? (
        <AddAnytimeLogDialog
          profile="cramble"
          initialView={addDialogInitialView}
          existingTitles={allTrackerTitles}
          onClose={() => setAddDialogInitialView(null)}
          onChooseScheduled={() => setIsScheduledHabitOpen(true)}
          onSubmit={onAddOpenActivity}
        />
      ) : null}
      {isScheduledHabitOpen ? (
        <AddHabitDialog
          profile="cramble"
          existingTitles={allTrackerTitles}
          onClose={() => setIsScheduledHabitOpen(false)}
          onSubmit={onAddHabit}
        />
      ) : null}
      {managedActivity && managedActivity.kind !== 'rating' ? (
        <AddAnytimeLogDialog
          profile="cramble"
          mode="edit"
          initialView="anytime"
          initialValue={{
            title: managedActivity.title,
            description: managedActivity.description,
            kind: managedActivity.kind,
            unit: managedActivity.unit,
            emoji: managedActivity.emoji,
            color: managedActivity.color,
          }}
          kindLocked={hasOpenActivityHistory(game, managedActivity.id)}
          lifecycleStatus={
            isHabitArchivedOnDate(game, managedActivity.id)
              ? 'archived'
              : getActiveHabitPause(game, managedActivity.id)
                ? 'paused'
                : 'active'
          }
          existingTitles={allTrackerTitles.filter(
            (title) => title !== managedActivity.title,
          )}
          onClose={() => setManagedActivityId(null)}
          onChooseScheduled={() => {}}
          onSubmit={(input) =>
            onEditOpenActivity(managedActivity.id, input)
          }
          onRequestPause={() => setPauseHabitId(managedActivity.id)}
          onResume={() => onResumeHabit(managedActivity.id)}
          onArchive={() => onArchiveHabit(managedActivity.id)}
          onRestore={() => onRestoreHabit(managedActivity.id)}
          onDelete={() => onDeleteHabit(managedActivity.id)}
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
          habitTitle={
            catalog.find((quest) => quest.id === pauseHabitId)?.title ??
            openActivities.find((activity) => activity.id === pauseHabitId)?.title
          }
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
          onRecordActivity={onBackfillOpenActivity}
          onUndoActivity={onUndoBackfillOpenActivity}
        />
      ) : null}
      {isExportOpen ? (
        <ExportDataDialog
          profile="cramble"
          game={game}
          baseQuests={crambleQuests}
          onClose={() => setIsExportOpen(false)}
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
