import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Compass } from 'lucide-react'
import { crambleQuests } from '@/data/crambleQuests'
import {
  createCustomHabitQuest,
  getNewHabitValidationError,
  hasSameHabitScoringRules,
  updateCustomHabitQuest,
  type NewHabitInput,
} from '@/lib/customHabits'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import {
  addDays,
  createInitialHanaState,
  createStartedHanaState,
  getQuestCatalog,
  getSkipEventKey,
  getSkipProgress,
  getSkipWeekKey,
  hasHanaStarted,
  parseStoredHanaState,
  recomputeTotalFlowers,
  recordQuestCompletionForDate,
  resetProfileProgress,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
  toggleQuestCompletion,
  undoQuestCompletionForDate,
  undoQuestCompletion,
} from '@/lib/hanaGame'
import {
  archiveHabit,
  deleteHabitPermanently,
  getActiveProfilePause,
  hasHabitHistory,
  isHabitGraduatedOnDate,
  restoreHabit,
  restoreGraduatedHabit,
  resumeHabitTracking,
  resumeProfileTracking,
  startHabitPause,
  startProfilePause,
  updateHabitPreferences,
  updateHabitWording,
  type PauseInput,
} from '@/lib/habitLifecycle'
import {
  chooseDbFirstState,
  loadHanaStateFromDb,
  saveProfileStateToDb,
} from '@/lib/hanaRemoteState'
import {
  createOpenActivity,
  getNewOpenActivityValidationError,
  hasOpenActivityHistory,
  incrementOpenActivityCountForDate,
  OPEN_ACTIVITY_LIMITS,
  recordOpenActivityForDate,
  setOpenActivityValueForDate,
  undoOpenActivityForDate,
  updateOpenActivityDefinition,
} from '@/lib/openActivities'
import {
  CramblePage,
  type CrambleSyncStatus,
} from '@/pages/CramblePage'
import { CrambleStartPage } from '@/pages/CrambleStartPage'
import { CrambleLedgerPage } from '@/pages/CrambleLedgerPage'
import { CrambleQuestDetailPage } from '@/pages/CrambleQuestDetailPage'
import { ObservatoryPage } from '@/pages/ObservatoryPage'
import type {
  DailyEmotion,
  HanaGameState,
  NewOpenActivityInput,
} from '@/types'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { useHabitReminders } from '@/hooks/useHabitReminders'
import { downloadProfileCsv } from '@/lib/habitExport'
import { millisecondsUntilNextLogicalDay } from '@/lib/logicalDay'
import { reconcileQuestGraduation } from '@/lib/questCompletion'
import { setDailyEmotion } from '@/lib/dailyEmotions'

type CrambleView = 'tracker' | 'observatory' | 'ledger' | 'ledgerDetail'
const CRAMBLE_CONFLICT_BACKUP_KEY = 'cramble-game/conflict-backup-v1'

type Props = {
  onBack: () => void
}

export function CrambleExperience({ onBack }: Props) {
  const [view, setView] = useState<CrambleView>('tracker')
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [game, setGame] = useState<HanaGameState | null>(null)
  useHabitReminders('cramble', game, crambleQuests)
  const gameRef = useRef<HanaGameState | null>(null)
  const pendingDbSaveRef = useRef<HanaGameState | null>(null)
  const isDbSaveInFlightRef = useRef(false)
  const syncConflictRef = useRef(false)
  const saveLoopPromiseRef = useRef<Promise<void> | null>(null)
  const hydrationSequenceRef = useRef(0)
  const localMutationRevisionRef = useRef(0)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CrambleSyncStatus>(
    import.meta.env.DEV ? 'disabled' : 'loading',
  )
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const cacheGame = useCallback((state: HanaGameState) => {
    window.localStorage.setItem(CRAMBLE_STORAGE_KEY, JSON.stringify(state))
  }, [])

  const clearCache = useCallback(() => {
    window.localStorage.removeItem(CRAMBLE_STORAGE_KEY)
  }, [])

  const cachePendingGame = useCallback((state: HanaGameState) => {
    window.localStorage.setItem(
      CRAMBLE_PENDING_STORAGE_KEY,
      JSON.stringify(state),
    )
  }, [])

  const clearPendingCache = useCallback(() => {
    window.localStorage.removeItem(CRAMBLE_PENDING_STORAGE_KEY)
  }, [])

  const clearPendingCacheIfSaved = useCallback((state: HanaGameState) => {
    const pending = window.localStorage.getItem(CRAMBLE_PENDING_STORAGE_KEY)
    if (pending === JSON.stringify(state)) {
      window.localStorage.removeItem(CRAMBLE_PENDING_STORAGE_KEY)
    }
  }, [])

  const readCachedGame = useCallback(() => {
    const saved = window.localStorage.getItem(CRAMBLE_STORAGE_KEY)
    return saved
      ? parseStoredHanaState(
          saved,
          crambleQuests,
          todayKey(),
          CRAMBLE_QUEST_PLAN_OPTIONS,
        )
      : null
  }, [])

  const readPendingGame = useCallback(() => {
    const saved = window.localStorage.getItem(CRAMBLE_PENDING_STORAGE_KEY)
    return saved
      ? parseStoredHanaState(
          saved,
          crambleQuests,
          todayKey(),
          CRAMBLE_QUEST_PLAN_OPTIONS,
        )
      : null
  }, [])

  const createInitialSyncedState = useCallback(
    () =>
      syncActiveQuestPlan(
        {
          ...createInitialHanaState(),
          currentDate: todayKey(),
        },
        crambleQuests,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      ),
    [],
  )

  const flushQueuedDbSave = useCallback((): Promise<void> => {
    if (import.meta.env.DEV) {
      return Promise.resolve()
    }

    if (saveLoopPromiseRef.current) {
      return saveLoopPromiseRef.current
    }

    const runSaveLoop = async () => {
      isDbSaveInFlightRef.current = true
      try {
        while (pendingDbSaveRef.current) {
          const stateToSave = pendingDbSaveRef.current
          pendingDbSaveRef.current = null
          const result = await saveProfileStateToDb(
            stateToSave,
            'cramble',
            crambleQuests,
          )

          if (!result.ok) {
            pendingDbSaveRef.current ??= stateToSave
            syncConflictRef.current = Boolean(result.conflict)
            setCloudSyncStatus(result.conflict ? 'conflict' : 'error')
            return
          }

          clearPendingCacheIfSaved(stateToSave)
          const baseRevision = stateToSave.syncRevision ?? 0
          const pending = pendingDbSaveRef.current as HanaGameState | null
          if (pending && (pending.syncRevision ?? 0) === baseRevision) {
            const revisedPending = {
              ...pending,
              syncRevision: result.revision,
            }
            pendingDbSaveRef.current = revisedPending
            cachePendingGame(revisedPending)
          }
          const latest = gameRef.current
          if (latest && (latest.syncRevision ?? 0) === baseRevision) {
            const revisedLatest = {
              ...latest,
              syncRevision: result.revision,
            }
            gameRef.current = revisedLatest
            setGame(revisedLatest)
            cacheGame(revisedLatest)
          }
          setLastCloudSyncAt(result.syncedAt)
        }
        setCloudSyncStatus('synced')
        syncConflictRef.current = false
      } finally {
        isDbSaveInFlightRef.current = false
      }
    }

    const savePromise = runSaveLoop().finally(() => {
      saveLoopPromiseRef.current = null
    })
    saveLoopPromiseRef.current = savePromise
    return savePromise
  }, [cacheGame, cachePendingGame, clearPendingCacheIfSaved])

  const hydrateFromDb = useCallback(
    async (silent = false) => {
      if (silent && (pendingDbSaveRef.current || isDbSaveInFlightRef.current)) {
        return false
      }

      const hydrationSequence = ++hydrationSequenceRef.current
      const mutationRevision = localMutationRevisionRef.current
      const initialState = createInitialSyncedState()
      const pendingState = readPendingGame()

      if (pendingState && hasHanaStarted(pendingState)) {
        setGame(pendingState)
        cacheGame(pendingState)

        if (import.meta.env.DEV) {
          clearPendingCache()
          setCloudSyncStatus('disabled')
          return true
        }

        pendingDbSaveRef.current = pendingState
        cachePendingGame(pendingState)
        if (!navigator.onLine) {
          setCloudSyncStatus('offline')
          return false
        }

        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
        return !pendingDbSaveRef.current
      }

      if (pendingState) {
        clearPendingCache()
      }

      if (import.meta.env.DEV) {
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState: readCachedGame(),
          initialState,
        })
        setGame(chosen.state)
        if (hasHanaStarted(chosen.state)) cacheGame(chosen.state)
        else clearCache()
        setCloudSyncStatus('disabled')
        return true
      }

      if (!navigator.onLine) {
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState: readCachedGame(),
          initialState,
        })
        setGame(chosen.state)
        if (hasHanaStarted(chosen.state)) cacheGame(chosen.state)
        else clearCache()
        if (!silent) setCloudSyncStatus('offline')
        return false
      }

      if (!silent) setCloudSyncStatus('loading')
      const remote = await loadHanaStateFromDb('cramble')
      const hydrationIsStale =
        hydrationSequence !== hydrationSequenceRef.current ||
        mutationRevision !== localMutationRevisionRef.current ||
        Boolean(pendingDbSaveRef.current)
      if (hydrationIsStale) {
        return false
      }

      if (!remote.ok) {
        const fallbackState =
          gameRef.current ?? readCachedGame() ?? createInitialSyncedState()
        setGame(fallbackState)
        if (hasHanaStarted(fallbackState)) cacheGame(fallbackState)
        else clearCache()
        if (!silent) setCloudSyncStatus('error')
        return false
      }

      if (!remote.snapshot) {
        setGame(initialState)
        clearCache()
        clearPendingCache()
        setLastCloudSyncAt(null)
        setCloudSyncStatus('idle')
        return true
      }

      const databaseState = {
        ...parseStoredHanaState(
          JSON.stringify(remote.snapshot.state),
          crambleQuests,
          todayKey(),
          CRAMBLE_QUEST_PLAN_OPTIONS,
        ),
        syncRevision: remote.snapshot.revision ?? 0,
      }
      const chosen = chooseDbFirstState({
        databaseState,
        cachedState: readCachedGame(),
        initialState,
      })
      const stateForToday = syncStateToDate(
        chosen.state,
        crambleQuests,
        todayKey(),
        CRAMBLE_QUEST_PLAN_OPTIONS,
      )

      if (!hasHanaStarted(stateForToday)) {
        const unstartedState = {
          ...initialState,
          syncRevision: remote.snapshot.revision ?? 0,
        }
        setGame(unstartedState)
        clearCache()
        clearPendingCache()
        setCloudSyncStatus('idle')
        return true
      }

      setGame(stateForToday)
      cacheGame(stateForToday)

      if (remote.snapshot.currentDate !== stateForToday.currentDate) {
        pendingDbSaveRef.current = stateForToday
        cachePendingGame(stateForToday)
        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
        return !pendingDbSaveRef.current
      }

      setLastCloudSyncAt(remote.snapshot.syncedAt)
      setCloudSyncStatus('synced')
      syncConflictRef.current = false
      return true
    },
    [
      cacheGame,
      cachePendingGame,
      clearCache,
      clearPendingCache,
      createInitialSyncedState,
      flushQueuedDbSave,
      readCachedGame,
      readPendingGame,
    ],
  )

  const commitGameState = useCallback(
    async (nextState: HanaGameState, silent = false) => {
      const stateForToday = syncStateToDate(
        nextState,
        crambleQuests,
        nextState.currentDate,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      )

      if (!hasHanaStarted(stateForToday)) {
        gameRef.current = stateForToday
        setGame(stateForToday)
        return false
      }

      localMutationRevisionRef.current += 1
      gameRef.current = stateForToday
      setGame(stateForToday)
      cacheGame(stateForToday)

      if (import.meta.env.DEV) {
        setCloudSyncStatus('disabled')
        return true
      }

      pendingDbSaveRef.current = stateForToday
      cachePendingGame(stateForToday)
      if (!navigator.onLine) {
        setCloudSyncStatus('offline')
        return false
      }

      if (!silent) setCloudSyncStatus('syncing')
      void flushQueuedDbSave()
      return true
    },
    [cacheGame, cachePendingGame, flushQueuedDbSave],
  )

  const refreshFromDb = useCallback(async () => {
    if (syncConflictRef.current) {
      const localState = gameRef.current
      const shouldLoadDatabase = window.confirm(
        'This profile changed on another device. Load the database copy now? Your current local copy will be downloaded as CSV and kept as a JSON recovery backup first.',
      )
      if (!shouldLoadDatabase) return false
      if (localState) {
        downloadProfileCsv(localState, crambleQuests, 'cramble')
        window.localStorage.setItem(
          CRAMBLE_CONFLICT_BACKUP_KEY,
          JSON.stringify(localState),
        )
      }
      pendingDbSaveRef.current = null
      clearPendingCache()
      syncConflictRef.current = false
      return hydrateFromDb(false)
    }
    if (pendingDbSaveRef.current || isDbSaveInFlightRef.current) {
      setCloudSyncStatus('syncing')
      await flushQueuedDbSave()
      if (pendingDbSaveRef.current) return false
    }
    return hydrateFromDb(false)
  }, [clearPendingCache, flushQueuedDbSave, hydrateFromDb])

  useEffect(() => {
    void hydrateFromDb()
  }, [hydrateFromDb])

  useEffect(() => {
    let rolloverTimer: number | null = null
    const syncToToday = () => {
      const current = gameRef.current
      if (!current || !hasHanaStarted(current)) return
      const currentDate = todayKey()
      if (import.meta.env.DEV && current.currentDate > currentDate) return
      if (current.currentDate !== currentDate) {
        void commitGameState(
          syncStateToDate(
            current,
            crambleQuests,
            currentDate,
            CRAMBLE_QUEST_PLAN_OPTIONS,
          ),
          true,
        )
      }
    }
    const scheduleRollover = () => {
      if (rolloverTimer !== null) window.clearTimeout(rolloverTimer)
      rolloverTimer = window.setTimeout(() => {
        syncToToday()
        scheduleRollover()
      }, millisecondsUntilNextLogicalDay() + 100)
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        syncToToday()
        scheduleRollover()
      }
    }
    const syncOnFocus = () => {
      syncToToday()
      scheduleRollover()
    }

    syncToToday()
    scheduleRollover()
    window.addEventListener('focus', syncOnFocus)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.removeEventListener('focus', syncOnFocus)
      document.removeEventListener('visibilitychange', syncWhenVisible)
      if (rolloverTimer !== null) window.clearTimeout(rolloverTimer)
    }
  }, [commitGameState])

  useEffect(() => {
    if (import.meta.env.DEV) return undefined

    const refreshSilently = () => void hydrateFromDb(true)
    const refreshAfterReconnect = async () => {
      const pendingState = pendingDbSaveRef.current ?? readPendingGame()
      if (pendingState && hasHanaStarted(pendingState)) {
        pendingDbSaveRef.current = pendingState
        cachePendingGame(pendingState)
        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
      }
      if (!pendingDbSaveRef.current) await hydrateFromDb(true)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSilently()
    }

    window.addEventListener('focus', refreshSilently)
    window.addEventListener('online', refreshAfterReconnect)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshSilently)
      window.removeEventListener('online', refreshAfterReconnect)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [
    cachePendingGame,
    flushQueuedDbSave,
    hydrateFromDb,
    readPendingGame,
  ])

  const startToday = async () => {
    const startDate = todayKey()
    const startedState = {
      ...syncStateToDate(
        createStartedHanaState(startDate),
        crambleQuests,
        startDate,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      ),
      syncRevision: gameRef.current?.syncRevision ?? 0,
    }

    if (import.meta.env.DEV) {
      localMutationRevisionRef.current += 1
      clearCache()
      clearPendingCache()
      pendingDbSaveRef.current = null
      setGame(startedState)
      cacheGame(startedState)
      setCloudSyncStatus('disabled')
      return
    }

    if (!navigator.onLine) {
      setCloudSyncStatus('offline')
      return
    }

    setCloudSyncStatus('syncing')
    const saveResult = await saveProfileStateToDb(
      startedState,
      'cramble',
      crambleQuests,
    )
    if (!saveResult.ok) {
      setCloudSyncStatus(saveResult.conflict ? 'conflict' : 'error')
      return
    }

    localMutationRevisionRef.current += 1
    const syncedStartedState = {
      ...startedState,
      syncRevision: saveResult.revision,
    }
    gameRef.current = syncedStartedState
    setGame(syncedStartedState)
    clearCache()
    clearPendingCache()
    pendingDbSaveRef.current = null
    cacheGame(syncedStartedState)
    setLastCloudSyncAt(saveResult.syncedAt)
    setCloudSyncStatus('synced')
    syncConflictRef.current = false
  }

  const toggleQuest = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === id)
    if (!quest) return

    const next = toggleQuestCompletion(previous, quest)
    const withUpdatedRenown = {
      ...next,
      totalFlowers: recomputeTotalFlowers(next, catalog),
    }
    void commitGameState(
      reconcileQuestGraduation(
        withUpdatedRenown,
        crambleQuests,
        'cramble',
        quest,
      ),
    )
  }

  const undoQuestOccurrence = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === id)
    if (!quest || quest.schedule?.kind !== 'periodTarget') return

    const next = undoQuestCompletion(previous, quest)
    if (next === previous) return
    const withUpdatedRenown = {
      ...next,
      totalFlowers: recomputeTotalFlowers(next, catalog),
    }
    void commitGameState(
      reconcileQuestGraduation(
        withUpdatedRenown,
        crambleQuests,
        'cramble',
        quest,
      ),
    )
  }

  const toggleSkip = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const quest = getQuestCatalog(crambleQuests, previous).find(
      (item) => item.id === id,
    )
    if (!quest) return

    const skipKey = getSkipEventKey(previous, quest)
    const storedWeekKey = Object.entries(previous.questSkips ?? {}).find(
      ([, skips]) => skips[skipKey] === true,
    )?.[0]
    const weekKey = storedWeekKey ?? getSkipWeekKey(previous.currentDate)
    const skipsThisWeek = previous.questSkips?.[weekKey] ?? {}
    const isSkipped = Boolean(skipsThisWeek[skipKey])
    if (!isSkipped && getSkipProgress(previous).remaining <= 0) return

    void commitGameState({
      ...previous,
      questSkips: {
        ...previous.questSkips,
        [weekKey]: {
          ...skipsThisWeek,
          [skipKey]: !isSkipped,
        },
      },
    })
  }

  const addCrambleHabit = (input: NewHabitInput) => {
    const previous = gameRef.current
    if (!previous || !hasHanaStarted(previous)) {
      return "Begin Cramble's First Oath before adding a habit."
    }

    const catalog = getQuestCatalog(crambleQuests, previous)
    const existingTitles = catalog.map((quest) => quest.title)
    const validationError = getNewHabitValidationError(input, existingTitles)
    if (validationError) {
      return validationError
    }

    const customHabit = createCustomHabitQuest(
      input,
      'cramble',
      previous.currentDate,
      existingTitles,
    )
    const withHabit: HanaGameState = {
      ...previous,
      customHabits: [...previous.customHabits, customHabit],
      questActivations: {
        ...(previous.questActivations ?? {}),
        [customHabit.id]: addDays(previous.currentDate, 1),
      },
    }
    void commitGameState(
      updateHabitPreferences(withHabit, customHabit.id, {
        cue: input.cue ?? '',
        reminderTime: input.reminderTime ?? null,
      }),
    )
    return null
  }

  const editCrambleHabit = (habitId: string, input: NewHabitInput) => {
    const previous = gameRef.current
    if (!previous) return 'Cramble’s tracker is not ready.'
    const catalog = getQuestCatalog(crambleQuests, previous)
    const habit = previous.customHabits.find((item) => item.id === habitId)
    const existingTitles = catalog
      .filter((quest) => quest.id !== habitId)
      .map((quest) => quest.title)
    const validationError = getNewHabitValidationError(input, existingTitles)
    if (validationError) return validationError
    if (!habit) {
      if (!catalog.some((quest) => quest.id === habitId)) {
        return 'That habit is unavailable.'
      }
      const withWording = updateHabitWording(previous, habitId, input)
      void commitGameState(
        updateHabitPreferences(withWording, habitId, {
          cue: input.cue ?? '',
          reminderTime: input.reminderTime ?? null,
        }),
      )
      return null
    }
    if (
      hasHabitHistory(previous, habitId) &&
      !hasSameHabitScoringRules(habit, input)
    ) {
      return 'Frequency and effort cannot change after tracking begins. Archive this habit and add its new rhythm instead.'
    }
    const updatedHabit = updateCustomHabitQuest(habit, input, existingTitles)
    const withDefinition: HanaGameState = {
      ...previous,
      customHabits: previous.customHabits.map((item) =>
        item.id === habitId ? updatedHabit : item,
      ),
    }
    void commitGameState(
      updateHabitPreferences(withDefinition, habitId, {
        cue: input.cue ?? '',
        reminderTime: input.reminderTime ?? null,
      }),
    )
    return null
  }

  const addCrambleOpenActivity = (input: NewOpenActivityInput) => {
    const previous = gameRef.current
    if (!previous || !hasHanaStarted(previous)) {
      return "Begin Cramble's First Oath before adding an anytime log."
    }
    if (previous.openActivities.length >= OPEN_ACTIVITY_LIMITS.definitions) {
      return 'This profile has reached its anytime-log limit.'
    }

    const existingTitles = [
      ...getQuestCatalog(crambleQuests, previous).map((quest) => quest.title),
      ...previous.openActivities.map((activity) => activity.title),
    ]
    const validationError = getNewOpenActivityValidationError(
      input,
      existingTitles,
    )
    if (validationError) return validationError

    try {
      const activity = createOpenActivity(
        input,
        'cramble',
        previous.currentDate,
        existingTitles,
      )
      void commitGameState({
        ...previous,
        openActivities: [...previous.openActivities, activity],
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not add this anytime log.'
    }
  }

  const editCrambleOpenActivity = (
    activityId: string,
    input: NewOpenActivityInput,
  ) => {
    const previous = gameRef.current
    if (!previous) return "Cramble's tracker is not ready."
    const activity = previous.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (!activity) return 'That anytime log is unavailable.'

    const existingTitles = [
      ...getQuestCatalog(crambleQuests, previous).map((quest) => quest.title),
      ...previous.openActivities
        .filter((candidate) => candidate.id !== activityId)
        .map((candidate) => candidate.title),
    ]
    const validationError = getNewOpenActivityValidationError(
      input,
      existingTitles,
    )
    if (validationError) return validationError

    const nextUnit = input.kind === 'count' ? input.unit?.trim() || null : null
    if (
      hasOpenActivityHistory(previous, activityId) &&
      (input.kind !== activity.kind || nextUnit !== activity.unit)
    ) {
      return 'Record type and unit cannot change after logging begins. Archive this item, then add the revised version with a different name.'
    }

    try {
      const updated = updateOpenActivityDefinition(
        activity,
        input,
        existingTitles,
      )
      void commitGameState({
        ...previous,
        openActivities: previous.openActivities.map((candidate) =>
          candidate.id === activityId ? updated : candidate,
        ),
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update this anytime log.'
    }
  }

  const changeCrambleOpenActivity = (
    activityId: string,
    delta: 1 | -1,
  ) => {
    const previous = gameRef.current
    if (!previous) return
    const activity = previous.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (!activity) return

    const nextState =
      activity.kind === 'check'
        ? setOpenActivityValueForDate(
            previous,
            activityId,
            previous.currentDate,
            delta > 0 ? 1 : 0,
          )
        : incrementOpenActivityCountForDate(
            previous,
            activityId,
            previous.currentDate,
            delta,
          )
    if (nextState !== previous) void commitGameState(nextState)
  }

  const setCrambleOpenActivityRating = (
    activityId: string,
    rating: number,
  ) => {
    const previous = gameRef.current
    if (!previous) return
    const activity = previous.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (activity?.kind !== 'rating') return
    const nextState = setOpenActivityValueForDate(
      previous,
      activityId,
      previous.currentDate,
      rating,
    )
    if (nextState !== previous) void commitGameState(nextState)
  }

  const setCrambleEmotion = (emotion: DailyEmotion) => {
    const previous = gameRef.current
    if (!previous || getActiveProfilePause(previous)) return
    const nextState = setDailyEmotion(previous, emotion)
    if (nextState !== previous) void commitGameState(nextState)
  }

  const pauseCrambleHabit = (habitId: string, input: PauseInput) => {
    const previous = gameRef.current
    if (previous) void commitGameState(startHabitPause(previous, habitId, input))
  }

  const resumeCrambleHabit = (habitId: string) => {
    const previous = gameRef.current
    if (previous) void commitGameState(resumeHabitTracking(previous, habitId))
  }

  const archiveCrambleHabit = (habitId: string) => {
    const previous = gameRef.current
    if (previous) void commitGameState(archiveHabit(previous, habitId))
  }

  const restoreCrambleHabit = (habitId: string) => {
    const previous = gameRef.current
    if (!previous) return
    void commitGameState(
      isHabitGraduatedOnDate(previous, habitId)
        ? restoreGraduatedHabit(previous, habitId)
        : restoreHabit(previous, habitId),
    )
  }

  const deleteCrambleHabit = (habitId: string) => {
    const previous = gameRef.current
    if (!previous) return
    const purged = deleteHabitPermanently(previous, habitId)
    const catalog = getQuestCatalog(crambleQuests, purged)
    void commitGameState({
      ...purged,
      totalFlowers: recomputeTotalFlowers(purged, catalog),
    })
  }

  const pauseAllCramble = (input: PauseInput) => {
    const previous = gameRef.current
    if (previous) void commitGameState(startProfilePause(previous, input))
  }

  const resumeAllCramble = () => {
    const previous = gameRef.current
    if (previous) void commitGameState(resumeProfileTracking(previous))
  }

  const backfillCramble = (dateKey: string, habitId: string) => {
    const previous = gameRef.current
    if (!previous) return 'Cramble’s tracker is not ready.'
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === habitId)
    if (!quest) return 'That habit is unavailable.'
    const result = recordQuestCompletionForDate(previous, quest, dateKey)
    if (result.error) return result.error
    const withUpdatedRenown = {
      ...result.state,
      totalFlowers: recomputeTotalFlowers(result.state, catalog),
    }
    void commitGameState(
      reconcileQuestGraduation(
        withUpdatedRenown,
        crambleQuests,
        'cramble',
        quest,
      ),
    )
    return null
  }

  const undoBackfillCramble = (dateKey: string, habitId: string) => {
    const previous = gameRef.current
    if (!previous) return "Cramble's tracker is not ready."
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === habitId)
    if (!quest) return 'That habit is unavailable.'
    const result = undoQuestCompletionForDate(previous, quest, dateKey)
    if (result.error) return result.error
    const withUpdatedRenown = {
      ...result.state,
      totalFlowers: recomputeTotalFlowers(result.state, catalog),
    }
    void commitGameState(
      reconcileQuestGraduation(
        withUpdatedRenown,
        crambleQuests,
        'cramble',
        quest,
      ),
    )
    return null
  }

  const backfillCrambleOpenActivity = (
    dateKey: string,
    activityId: string,
  ) => {
    const previous = gameRef.current
    if (!previous) return "Cramble's tracker is not ready."
    const result = recordOpenActivityForDate(previous, activityId, dateKey)
    if (result.error) return result.error
    void commitGameState(result.state)
    return result.error
  }

  const undoBackfillCrambleOpenActivity = (
    dateKey: string,
    activityId: string,
  ) => {
    const previous = gameRef.current
    if (!previous) return "Cramble's tracker is not ready."
    const result = undoOpenActivityForDate(previous, activityId, dateKey)
    if (result.error) return result.error
    void commitGameState(result.state)
    return result.error
  }

  const goToNextDay = () => {
    const previous = gameRef.current
    if (!previous) return
    void commitGameState(
      syncActiveQuestPlan(
        { ...previous, currentDate: addDays(previous.currentDate, 1) },
        crambleQuests,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      ),
    )
  }

  const reset = () => {
    clearCache()
    const previous = gameRef.current
    if (!previous) return
    void commitGameState(
      resetProfileProgress(
        previous,
        crambleQuests,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      ),
    )
  }

  if (!game) {
    return <CrambleLoadingPage status={cloudSyncStatus} onBack={onBack} />
  }

  if (!hasHanaStarted(game)) {
    return (
      <CrambleStartPage
        onBack={onBack}
        onStart={() => void startToday()}
        isSaving={cloudSyncStatus === 'syncing'}
        isOffline={cloudSyncStatus === 'offline'}
        statusText={getStartStatus(cloudSyncStatus)}
      />
    )
  }

  if (view === 'observatory') {
    return <ObservatoryPage game={game} onBack={() => setView('tracker')} />
  }

  if (view === 'ledger') {
    return (
      <CrambleLedgerPage
        game={game}
        onBack={() => setView('tracker')}
        onRestoreHabit={restoreCrambleHabit}
        onDeleteHabit={deleteCrambleHabit}
        onOpenQuest={(questId) => {
          setSelectedQuestId(questId)
          setView('ledgerDetail')
        }}
      />
    )
  }

  if (view === 'ledgerDetail' && selectedQuestId) {
    return (
      <CrambleQuestDetailPage
        game={game}
        questId={selectedQuestId}
        onBack={() => setView('ledger')}
      />
    )
  }

  return (
    <CramblePage
      game={game}
      onToggle={toggleQuest}
      onUndoOccurrence={undoQuestOccurrence}
      onAddHabit={addCrambleHabit}
      onEditHabit={editCrambleHabit}
      onAddOpenActivity={addCrambleOpenActivity}
      onEditOpenActivity={editCrambleOpenActivity}
      onIncrementOpenActivity={(activityId) =>
        changeCrambleOpenActivity(activityId, 1)
      }
      onDecrementOpenActivity={(activityId) =>
        changeCrambleOpenActivity(activityId, -1)
      }
      onSetOpenActivityRating={setCrambleOpenActivityRating}
      onSetDailyEmotion={setCrambleEmotion}
      onPauseHabit={pauseCrambleHabit}
      onResumeHabit={resumeCrambleHabit}
      onArchiveHabit={archiveCrambleHabit}
      onRestoreHabit={restoreCrambleHabit}
      onDeleteHabit={deleteCrambleHabit}
      onPauseTracking={pauseAllCramble}
      onResumeTracking={resumeAllCramble}
      onBackfill={backfillCramble}
      onUndoBackfill={undoBackfillCramble}
      onBackfillOpenActivity={backfillCrambleOpenActivity}
      onUndoBackfillOpenActivity={undoBackfillCrambleOpenActivity}
      onSkip={toggleSkip}
      onOpenObservatory={() => setView('observatory')}
      onOpenLedger={() => setView('ledger')}
      onNextDay={goToNextDay}
      onReset={reset}
      onSyncCloud={() => void refreshFromDb()}
      cloudSyncStatus={cloudSyncStatus}
      lastCloudSyncAt={lastCloudSyncAt}
      onBack={onBack}
    />
  )
}

function CrambleLoadingPage({
  status,
  onBack,
}: {
  status: CrambleSyncStatus
  onBack: () => void
}) {
  const headingRef = usePageHeadingFocus()

  return (
    <div
      className="cramble-archive-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6"
      aria-busy={status === 'loading' || status === 'syncing'}
    >
      <button
        type="button"
        onClick={onBack}
        className="relative z-10 flex min-h-11 items-center justify-center gap-1 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink shadow-sm outline-none transition active:scale-95 motion-reduce:transition-none"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </button>
      <div className="relative z-10 grid flex-1 place-items-center text-center">
        <div className="cramble-codex-card rounded-card border border-border bg-surface p-6 shadow-sm">
          <div className="cramble-compass-medallion mx-auto grid size-16 place-items-center rounded-full">
            <Compass className="size-8" aria-hidden="true" />
          </div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-2xl font-semibold tracking-tight text-ink outline-none"
          >
            Opening Cramble's archive
          </h1>
          <p
            className="mt-2 text-sm leading-6 text-muted"
            role="status"
            aria-live="polite"
          >
            {status === 'offline'
              ? 'Offline right now. Using Cramble’s separate saved cache.'
              : 'Loading Cramble’s separate chronicle from the database.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function getStartStatus(status: CrambleSyncStatus) {
  if (status === 'syncing') return 'Preparing the first page in Cramble’s database record.'
  if (status === 'offline') return 'Connect to the internet once to begin the chronicle.'
  if (status === 'error') return 'The archive could not be reached. Try again when the connection is steady.'
  if (status === 'disabled') return 'Local development records this chronicle only on this device.'
  return 'Nothing is saved for Cramble until the First Oath begins.'
}
