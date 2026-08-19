import { useState } from 'react'
import { AddHabitDialog } from '@/components/AddHabitDialog'
import { AvailableQuestsSection } from '@/components/AvailableQuestsSection'
import { EveningWeeds } from '@/components/EveningWeeds'
import { HanaJourneyCard } from '@/components/HanaJourneyCard'
import { PauseTrackingDialog } from '@/components/PauseTrackingDialog'
import { QuestInfoDialog } from '@/components/QuestInfoDialog'
import { QuestSection } from '@/components/QuestSection'
import {
  PausedHabitsCard,
  ProfilePauseBanner,
} from '@/components/TodayHabitControls'
import { quests } from '@/data/quests'
import hanaWeeds from '@/data/hanaWeeds.json'
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
  getAvailableQuestsForState,
  getLevelProgress,
  getLongTermCheckedIds,
  getQuestCatalog,
  getQuestScheduleProgress,
  getSkippedIdsForState,
  getSkipProgress,
  getSpringArcProgress,
  getWeedProgress,
  isQuestActivatedOnDate,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import type { GardenWeed, HanaGameState } from '@/types'

const eveningWeeds = hanaWeeds as GardenWeed[]

export type HanaQuestHubPanelProps = {
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
  onActivateQuest: (id: string) => void
  onToggleWeed: (id: string) => void
}

export function HanaQuestHubPanel({
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
  onActivateQuest,
  onToggleWeed,
}: HanaQuestHubPanelProps) {
  const [managedHabitId, setManagedHabitId] = useState<string | null>(null)
  const [pauseHabitId, setPauseHabitId] = useState<string | null>(null)
  const [infoQuestId, setInfoQuestId] = useState<string | null>(null)
  const catalog = getQuestCatalog(quests, game)
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
  const longTermCheckedIds = getLongTermCheckedIds(game)
  const skippedIds = getSkippedIdsForState(catalog, game)
  const skipProgress = getSkipProgress(game)
  const weedCheckedIds = game.eveningWeeds?.[game.currentDate] ?? {}
  const weedProgress = getWeedProgress(game)
  const springArc = getSpringArcProgress(game)
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

  return (
    <>
      <div className="mt-4">
        <HanaJourneyCard
          totalFlowers={game.totalFlowers}
          levelProgress={levelProgress}
          springArc={springArc}
        />
      </div>

      {activeProfilePause ? (
        <ProfilePauseBanner pause={activeProfilePause} onResume={onResumeTracking} />
      ) : null}

      {!activeProfilePause ? (
        <div className="hana-quest-stack mt-4 space-y-5">
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

      <div className="mt-5 space-y-5">
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

      {managedQuest ? (
        <AddHabitDialog
          profile="hana"
          mode="edit"
          originalEmoji={
            quests.find((quest) => quest.id === managedQuest.id)?.emoji
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

      {pauseHabitId ? (
        <PauseTrackingDialog
          profile="hana"
          currentDate={game.currentDate}
          habitTitle={catalog.find((quest) => quest.id === pauseHabitId)?.title}
          onClose={() => setPauseHabitId(null)}
          onSubmit={(input) => onPauseHabit(pauseHabitId, input)}
        />
      ) : null}
    </>
  )
}
