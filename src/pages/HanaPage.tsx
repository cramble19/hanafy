import {
  CalendarDays,
  ChevronLeft,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { quests } from '@/data/quests'
import hanaWeeds from '@/data/hanaWeeds.json'
import springQuotes from '@/data/springQuotes.json'
import { EveningWeeds } from '@/components/EveningWeeds'
import { AddHabitDialog } from '@/components/AddHabitDialog'
import { AddAnytimeLogDialog } from '@/components/AddAnytimeLogDialog'
import { AnytimeLogSection } from '@/components/AnytimeLogSection'
import { DailyEmotionPicker } from '@/components/DailyEmotionPicker'
import { BackfillDialog } from '@/components/BackfillDialog'
import { ExportDataDialog } from '@/components/ExportDataDialog'
import { PauseTrackingDialog } from '@/components/PauseTrackingDialog'
import { QuestInfoDialog } from '@/components/QuestInfoDialog'
import { CloudSyncNotice } from '@/components/CloudSyncNotice'
import { QuestSection } from '@/components/QuestSection'
import { AvailableQuestsSection } from '@/components/AvailableQuestsSection'
import { HanaJourneyCard } from '@/components/HanaJourneyCard'
import {
  TrackerViewTabs,
  trackerViewPanelId,
  trackerViewTabId,
  type TrackerView,
} from '@/components/TrackerViewTabs'
import {
  PausedHabitsCard,
  ProfilePauseBanner,
  TodayProgressCard,
  TodayUtilityActions,
} from '@/components/TodayHabitControls'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { GardenBlossomIcon } from '@/components/icons/GardenBlossomIcon'
import { HanaAddHabitIcon } from '@/components/icons/HanaAddHabitIcon'
import { HanaLedgerIcon } from '@/components/icons/HanaLedgerIcon'
import {
  displayDate,
  getLongTermCheckedIds,
  getAvailableQuestsForState,
  getLevelProgress,
  getQuestCatalog,
  getQuestScheduleProgress,
  isQuestActivatedOnDate,
  getSkippedIdsForState,
  getSkipProgress,
  getSpringArcProgress,
  getWeedProgress,
  visibleQuestsForState,
} from '@/lib/hanaGame'
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
  isHabitGraduatedOnDate,
  type PauseInput,
} from '@/lib/habitLifecycle'
import {
  getOpenActivityCatalog,
  hasOpenActivityHistory,
} from '@/lib/openActivities'
import { downloadProfileJson } from '@/lib/habitExport'
import type {
  GardenWeed,
  HanaGameState,
  DailyEmotion,
  NewOpenActivityInput,
} from '@/types'

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
  onUndoOccurrence: (id: string) => void
  onAddHabit: (input: NewHabitInput) => string | null
  onEditHabit: (habitId: string, input: NewHabitInput) => string | null
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
  onSkip: (id: string) => void
  onActivateQuest: (id: string) => void
  onToggleWeed: (id: string) => void
  onOpenGarden: () => void
  onOpenLedger: () => void
  onNextDay: () => void
  onReset: () => void
  onSyncCloud: () => void
  cloudSyncStatus:
    | 'idle'
    | 'loading'
    | 'syncing'
    | 'synced'
    | 'error'
    | 'conflict'
    | 'offline'
    | 'disabled'
    | 'preview'
  lastCloudSyncAt: string | null
  hasPendingCloudSave: boolean
  saveConfirmedAt: number | null
  onBack: () => void
}

export function HanaPage({
  game,
  onToggle,
  onUndoOccurrence,
  onAddHabit,
  onEditHabit,
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
  onSkip,
  onActivateQuest,
  onToggleWeed,
  onOpenGarden,
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
  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false)
  const [isScheduledHabitOpen, setIsScheduledHabitOpen] = useState(false)
  const [managedHabitId, setManagedHabitId] = useState<string | null>(null)
  const [managedActivityId, setManagedActivityId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [isPauseTrackingOpen, setIsPauseTrackingOpen] = useState(false)
  const [isBackfillOpen, setIsBackfillOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [infoQuestId, setInfoQuestId] = useState<string | null>(null)
  const [trackerView, setTrackerView] = useState<TrackerView>('quests')
  const catalog = getQuestCatalog(quests, game)
  const openActivities = getOpenActivityCatalog(game)
  const levelProgress = getLevelProgress(game.totalFlowers)
  const visibleQuests = visibleQuestsForState(catalog, game)
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
  const skippedIds = getSkippedIdsForState(catalog, game)
  const skipProgress = getSkipProgress(game)
  const weedCheckedIds = game.eveningWeeds?.[game.currentDate] ?? {}
  const weedProgress = getWeedProgress(game)
  const longTermCheckedIds = getLongTermCheckedIds(game)
  const activeProfilePause = getActiveProfilePause(game)
  const pausedHabits = catalog.filter(
    (quest) =>
      quest.catalogState !== 'legacy' &&
      isQuestActivatedOnDate(game, quest.id) &&
      !isHabitArchivedOnDate(game, quest.id) &&
      !isHabitGraduatedOnDate(game, quest.id) &&
      Boolean(getActiveHabitPause(game, quest.id)),
  )
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
  const managedQuest = catalog.find((habit) => habit.id === managedHabitId)
  const managedActivity = openActivities.find(
    (activity) => activity.id === managedActivityId,
  )
  const allTrackerTitles = [
    ...catalog.map((quest) => quest.title),
    ...openActivities.map((activity) => activity.title),
  ]
  const infoQuest = catalog.find((quest) => quest.id === infoQuestId)
  const availableQuests = getAvailableQuestsForState(catalog, game)
  const pendingQuests = catalog.filter(
    (quest) =>
      quest.catalogState !== 'legacy' &&
      Boolean(game.questActivations?.[quest.id]) &&
      (game.questActivations?.[quest.id] ?? '') > game.currentDate,
  )
  const questsReadyToAdd = [...availableQuests, ...pendingQuests].sort(
    (first, second) =>
      (first.minLevel ?? 1) - (second.minLevel ?? 1) ||
      first.title.localeCompare(second.title),
  )
  const todayTotal = visibleQuests.daily.length + visibleQuests.longTerm.length
  const todayComplete =
    Object.values(dailyCheckedIds).filter(Boolean).length +
    Object.values(longTermCheckedIds).filter(Boolean).length
  const springArc = getSpringArcProgress(game)
  const seasonalQuote = getSeasonalQuote(game.currentDate)
  const showDevControls = import.meta.env.DEV
  const resetWithConfirmation = () => {
    if (window.confirm("Reset Hana's flowers and checked quests?")) {
      onReset()
    }
  }

  return (
    <div className="hana-spring-shell mx-auto min-h-full w-full max-w-md px-5 pb-8 pt-6">
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
          <FlowerMark className="size-5" />
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

      <DailyEmotionPicker
        profile="hana"
        value={game.dailyEmotions[game.currentDate] ?? null}
        disabled={Boolean(activeProfilePause)}
        onChange={onSetDailyEmotion}
      />

      <TrackerViewTabs
        profile="hana"
        value={trackerView}
        onChange={setTrackerView}
      />

      <section
        id={trackerViewPanelId('hana', 'quests')}
        className="tracker-view-panel"
        role="tabpanel"
        aria-labelledby={trackerViewTabId('hana', 'quests')}
        hidden={trackerView !== 'quests'}
      >
        <TodayProgressCard
          profile="hana"
          complete={todayComplete}
          total={todayTotal}
        />
        {activeProfilePause ? (
          <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
        ) : null}
        {!activeProfilePause ? (
          <div className="mt-6 space-y-8">
            <QuestSection
              title="Daily Quests"
              quests={visibleQuests.daily}
              checkedIds={dailyCheckedIds}
              skippedIds={skippedIds}
              periodProgressById={periodProgressById}
              onOpenInfo={setInfoQuestId}
              onToggle={onToggle}
            />
            <QuestSection
              title="Long Term Quests"
              quests={visibleQuests.longTerm}
              checkedIds={longTermCheckedIds}
              skippedIds={skippedIds}
              onOpenInfo={setInfoQuestId}
              onToggle={onToggle}
            />
            <AvailableQuestsSection
              quests={questsReadyToAdd}
              activationDates={game.questActivations ?? {}}
              currentDate={game.currentDate}
              onAdd={onActivateQuest}
            />
          </div>
        ) : null}

        <PausedHabitsCard
          habits={pausedHabits}
          title="Paused quests"
          onResume={onResumeHabit}
          onManage={setManagedHabitId}
        />

        <HanaJourneyCard
          totalFlowers={game.totalFlowers}
          levelProgress={levelProgress}
          springArc={springArc}
          onOpenGarden={onOpenGarden}
        />

        <div className="mt-8 space-y-8">
          <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted shadow-sm">
            <span className="font-medium text-ink">Weekly skips:</span>{' '}
            {skipProgress.remaining}/{skipProgress.limit} left
            <p className="mt-1 text-xs text-faint">
              Skips reset every Sunday. A skipped quest gives 0 flowers.
            </p>
          </div>
          {!activeProfilePause ? (
            <EveningWeeds
              weeds={eveningWeeds}
              checkedIds={weedCheckedIds}
              weedsTowardNextWilt={weedProgress.weedsTowardNextWilt}
              weedsPerWiltedFlower={weedProgress.weedsPerWiltedFlower}
              wiltedFlowers={weedProgress.wiltedFlowers}
              onToggle={onToggleWeed}
            />
          ) : null}
        </div>
      </section>

      <section
        id={trackerViewPanelId('hana', 'anytime')}
        className="tracker-view-panel"
        role="tabpanel"
        aria-labelledby={trackerViewTabId('hana', 'anytime')}
        hidden={trackerView !== 'anytime'}
      >
        {activeProfilePause ? (
          <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
        ) : null}
        <AnytimeLogSection
          profile="hana"
          activities={activeOpenActivities}
          todayCounts={game.openActivityLogs[game.currentDate] ?? {}}
          disabled={Boolean(activeProfilePause)}
          onIncrement={onIncrementOpenActivity}
          onDecrement={onDecrementOpenActivity}
          onSetRating={onSetOpenActivityRating}
          onManage={setManagedActivityId}
        />
        <PausedHabitsCard
          habits={pausedOpenActivities}
          title="Paused anytime logs"
          onResume={onResumeHabit}
          onManage={setManagedActivityId}
        />
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

      <TodayUtilityActions
        isPaused={Boolean(activeProfilePause)}
        onPause={() => setIsPauseTrackingOpen(true)}
        onBackfill={() => setIsBackfillOpen(true)}
        onExport={() => setIsExportOpen(true)}
      />

      <CloudSyncNotice
        profile="hana"
        status={cloudSyncStatus}
        hasPendingSave={hasPendingCloudSave}
        saveConfirmedAt={saveConfirmedAt}
        onRetry={onSyncCloud}
        onExportBackup={() => downloadProfileJson(game, quests, 'hana')}
      />

      <nav
        className="profile-action-bar profile-action-bar-hana"
        aria-label="Hana actions"
      >
        <button
          type="button"
          onClick={() => setIsAddHabitOpen(true)}
          disabled={!game.startDate}
          className="habit-add-button"
          aria-label={
            game.startDate
              ? 'Add a habit for Hana'
              : "Start Hana's Health Overhaul to add habits"
          }
        >
          <HanaAddHabitIcon className="size-8 shrink-0" />
          <span className="profile-action-copy">
            <span className="profile-action-label">Add habit</span>
            <span className="profile-action-detail">
              {game.startDate
                ? 'Add a scheduled habit or anytime log'
                : 'Start the Health Overhaul first'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenGarden}
          className="profile-action-button"
          aria-label={`Open Hana's night garden. ${game.totalFlowers} flowers planted and ${skipProgress.remaining} skips left`}
        >
          <GardenBlossomIcon className="size-8 shrink-0" />
          <span className="profile-action-copy">
            <span className="profile-action-label">Garden</span>
            <span className="profile-action-detail">
              {game.totalFlowers} flowers planted · {skipProgress.remaining} skips left
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenLedger}
          className="profile-action-button sticky-stats-button"
          aria-label="Open Hana's Ledger"
        >
          <HanaLedgerIcon className="size-8 shrink-0" />
          <span className="profile-action-copy">
            <span className="profile-action-label">Ledger</span>
            <span className="profile-action-detail">
              See every goal window and recorded day
            </span>
          </span>
        </button>
      </nav>

      {isAddHabitOpen ? (
        <AddAnytimeLogDialog
          profile="hana"
          existingTitles={allTrackerTitles}
          onClose={() => setIsAddHabitOpen(false)}
          onChooseScheduled={() => setIsScheduledHabitOpen(true)}
          onSubmit={onAddOpenActivity}
        />
      ) : null}
      {isScheduledHabitOpen ? (
        <AddHabitDialog
          profile="hana"
          existingTitles={allTrackerTitles}
          onClose={() => setIsScheduledHabitOpen(false)}
          onSubmit={onAddHabit}
        />
      ) : null}
      {managedQuest ? (
        <AddHabitDialog
          profile="hana"
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
      {infoQuest ? (
        <QuestInfoDialog
          profile="hana"
          game={game}
          baseQuests={quests}
          quest={infoQuest}
          checked={
            infoQuest.group === 'longTerm'
              ? Boolean(longTermCheckedIds[infoQuest.id])
              : Boolean(dailyCheckedIds[infoQuest.id])
          }
          skipped={Boolean(skippedIds[infoQuest.id])}
          canSkip={skipProgress.remaining > 0}
          periodProgress={periodProgressById[infoQuest.id]}
          onClose={() => setInfoQuestId(null)}
          onManage={() => setManagedHabitId(infoQuest.id)}
          onSkip={() => onSkip(infoQuest.id)}
          onUndoOccurrence={
            infoQuest.schedule?.kind === 'periodTarget'
              ? () => onUndoOccurrence(infoQuest.id)
              : undefined
          }
        />
      ) : null}
      {managedActivity && managedActivity.kind !== 'rating' ? (
        <AddAnytimeLogDialog
          profile="hana"
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
          profile="hana"
          currentDate={game.currentDate}
          onClose={() => setIsPauseTrackingOpen(false)}
          onSubmit={onPauseTracking}
        />
      ) : null}
      {pauseHabitId ? (
        <PauseTrackingDialog
          profile="hana"
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
          profile="hana"
          game={game}
          baseQuests={quests}
          onClose={() => setIsBackfillOpen(false)}
          onRecord={onBackfill}
          onUndo={onUndoBackfill}
          onRecordActivity={onBackfillOpenActivity}
          onUndoActivity={onUndoBackfillOpenActivity}
        />
      ) : null}
      {isExportOpen ? (
        <ExportDataDialog
          profile="hana"
          game={game}
          baseQuests={quests}
          onClose={() => setIsExportOpen(false)}
        />
      ) : null}
    </div>
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
    return 'Preview only. Press Start Health Overhaul before saving to the database.'
  }
  if (status === 'loading') {
    return 'Loading the latest garden from the database...'
  }
  if (status === 'syncing') {
    return "Saving Hana's latest change to the database..."
  }
  if (status === 'error') {
    return 'Database save failed. Refresh will retry the latest local garden first.'
  }
  if (status === 'conflict') {
    return 'A newer database garden exists. Export is automatic when you press sync to review it.'
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
