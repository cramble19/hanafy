import {
  CalendarDays,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
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
  onRecordRecentEmotion?: (dateKey: string, emotion: DailyEmotion) => string | null
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
  onOpenSomeday: () => void
  onOpenLedger: () => void
  onOpenRhythm?: () => void
  onNextDay: () => void
  onReset: () => void
  onSyncCloud: () => void
  cloudSyncStatus: CrambleSyncStatus
  lastCloudSyncAt: string | null
  hasPendingCloudSave: boolean
  saveConfirmedAt: number | null
  onBack?: () => void
}

const chronicleLines = crambleChronicles as ChronicleLine[]

export function CramblePage({
  game,
  onAddOpenActivity,
  onEditOpenActivity,
  onIncrementOpenActivity,
  onDecrementOpenActivity,
  onSetOpenActivityRating,
  onSetDailyEmotion,
  onRecordRecentEmotion,
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
  const [managedActivityId, setManagedActivityId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [isPauseTrackingOpen, setIsPauseTrackingOpen] = useState(false)
  const [isBackfillOpen, setIsBackfillOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const headingRef = usePageHeadingFocus()
  const catalog = getQuestCatalog(crambleQuests, game)
  const openActivities = getOpenActivityCatalog(game)
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
        <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          Cramble
        </h1>
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays className="size-4" aria-hidden="true" />
            {displayDate(game.currentDate)}
          </p>
          <button
            type="button"
            onClick={onSyncCloud}
            disabled={
              cloudSyncStatus === 'loading' ||
              cloudSyncStatus === 'syncing' ||
              cloudSyncStatus === 'disabled'
            }
            className="inline-grid size-11 shrink-0 place-items-center rounded-full border border-border bg-transparent p-0 text-ink outline-none transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
            aria-label="Refresh Cramble's progress from database"
            title="Refresh"
          >
            <RefreshCw
              className={`size-4 ${
                cloudSyncStatus === 'loading' || cloudSyncStatus === 'syncing'
                  ? 'animate-spin motion-reduce:animate-none'
                  : ''
              }`}
              aria-hidden="true"
            />
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

      <section className="cramble-quote-compact relative z-10" aria-label="Quote for today">
        <blockquote>“{line.text}”</blockquote>
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

      <button type="button" className="cramble-inline-add" onClick={() => setAddDialogInitialView('anytime')}>
        <Plus size={18} aria-hidden="true" /> Add habit
      </button>

      {addDialogInitialView ? (
        <AddAnytimeLogDialog
          profile="cramble"
          initialView={addDialogInitialView}
          allowScheduled={false}
          existingTitles={allTrackerTitles}
          onClose={() => setAddDialogInitialView(null)}
          onChooseScheduled={() => {}}
          onSubmit={onAddOpenActivity}
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
          onRecordEmotion={onRecordRecentEmotion}
          activitiesOnly
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
