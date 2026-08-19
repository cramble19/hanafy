import { Compass } from 'lucide-react'
import { useState } from 'react'
import { AddHabitDialog } from '@/components/AddHabitDialog'
import { PauseTrackingDialog } from '@/components/PauseTrackingDialog'
import { QuestInfoDialog } from '@/components/QuestInfoDialog'
import { QuestSection } from '@/components/QuestSection'
import {
  PausedHabitsCard,
  ProfilePauseBanner,
  TodayProgressCard,
} from '@/components/TodayHabitControls'
import { crambleQuests } from '@/data/crambleQuests'
import { getCrambleChapterProgress } from '@/lib/crambleGame'
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
  getLevelProgress,
  getLongTermCheckedIds,
  getQuestCatalog,
  getQuestScheduleProgress,
  getSkippedIdsForState,
  getSkipProgress,
  isQuestActivatedOnDate,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import type { HanaGameState } from '@/types'

export type CrambleQuestHubPanelProps = {
  game: HanaGameState
  onToggle: (id: string) => void
  onUndoOccurrence: (id: string) => void
  onEditHabit: (habitId: string, input: NewHabitInput) => string | null
  onPauseHabit: (habitId: string, input: PauseInput) => void
  onResumeHabit: (habitId: string) => void
  onArchiveHabit: (habitId: string) => void
  onRestoreHabit: (habitId: string) => void
  onDeleteHabit: (habitId: string) => void
  onResumeTracking: () => void
  onSkip: (id: string) => void
}

export function CrambleQuestHubPanel({
  game,
  onToggle,
  onUndoOccurrence,
  onEditHabit,
  onPauseHabit,
  onResumeHabit,
  onArchiveHabit,
  onRestoreHabit,
  onDeleteHabit,
  onResumeTracking,
  onSkip,
}: CrambleQuestHubPanelProps) {
  const [managedHabitId, setManagedHabitId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [infoQuestId, setInfoQuestId] = useState<string | null>(null)
  const catalog = getQuestCatalog(crambleQuests, game)
  const levelProgress = getLevelProgress(game.totalFlowers)
  const chapter = getCrambleChapterProgress(game)
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
  const longTermCheckedIds = getLongTermCheckedIds(game)
  const skippedIds = getSkippedIdsForState(catalog, game)
  const skipProgress = getSkipProgress(game)
  const activeProfilePause = getActiveProfilePause(game)
  const pausedHabits = catalog.filter(
    (quest) =>
      quest.catalogState !== 'legacy' &&
      isQuestActivatedOnDate(game, quest.id) &&
      !isHabitArchivedOnDate(game, quest.id) &&
      !isHabitGraduatedOnDate(game, quest.id) &&
      Boolean(getActiveHabitPause(game, quest.id)),
  )
  const managedQuest = catalog.find((quest) => quest.id === managedHabitId)
  const infoQuest = catalog.find((quest) => quest.id === infoQuestId)
  const todayTotal = visibleQuests.daily.length + visibleQuests.longTerm.length
  const todayComplete =
    Object.values(dailyCheckedIds).filter(Boolean).length +
    Object.values(longTermCheckedIds).filter(Boolean).length

  return (
    <>
      <div className="mt-4">
        <TodayProgressCard
          profile="cramble"
          complete={todayComplete}
          total={todayTotal}
        />
      </div>

      {activeProfilePause ? (
        <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
      ) : null}

      {!activeProfilePause ? (
        <div className="relative z-10 mt-6 space-y-8">
          <QuestSection
            title="Daily Lessons"
            quests={visibleQuests.daily}
            checkedIds={dailyCheckedIds}
            skippedIds={skippedIds}
            periodProgressById={periodProgressById}
            onOpenInfo={setInfoQuestId}
            variant="archive"
            onToggle={onToggle}
          />
          {visibleQuests.longTerm.length > 0 ? (
            <QuestSection
              title="Long Studies"
              quests={visibleQuests.longTerm}
              checkedIds={longTermCheckedIds}
              skippedIds={skippedIds}
              onOpenInfo={setInfoQuestId}
              variant="archive"
              onToggle={onToggle}
            />
          ) : null}
        </div>
      ) : null}

      <PausedHabitsCard
        habits={pausedHabits}
        title="Paused lessons"
        onResume={onResumeHabit}
        onManage={setManagedHabitId}
      />

      <section className="cramble-codex-card relative z-10 mt-7 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
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
      </section>

      <div className="cramble-codex-card relative z-10 mt-7 rounded-card border border-border bg-surface p-4 text-sm text-muted shadow-sm">
        <span className="font-medium text-ink">Weekly passes:</span>{' '}
        {skipProgress.remaining}/{skipProgress.limit} left
        <p className="mt-1 text-xs text-faint">
          Passes renew every Sunday. A pass earns no renown, but it never breaks
          your progress.
        </p>
      </div>

      <section className="cramble-chapter-card relative z-10 mt-8 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm">
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

      {managedQuest ? (
        <AddHabitDialog
          profile="cramble"
          mode="edit"
          originalEmoji={
            crambleQuests.find((quest) => quest.id === managedQuest.id)?.emoji
          }
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
          profile="cramble"
          game={game}
          baseQuests={crambleQuests}
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

      {pauseHabitId ? (
        <PauseTrackingDialog
          profile="cramble"
          currentDate={game.currentDate}
          habitTitle={catalog.find((quest) => quest.id === pauseHabitId)?.title}
          onClose={() => setPauseHabitId(null)}
          onSubmit={(input) => onPauseHabit(pauseHabitId, input)}
        />
      ) : null}
    </>
  )
}
