import { useCallback, useEffect, useRef, useState } from 'react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { quests } from '@/data/quests'
import { crambleQuests } from '@/data/crambleQuests'
import {
  createCustomHabitQuest,
  getNewHabitValidationError,
  hasSameHabitScoringRules,
  updateCustomHabitQuest,
  type NewHabitInput,
} from '@/lib/customHabits'
import {
  addDays,
  activateQuest,
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
  STORAGE_KEY,
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
  saveHanaStateToDb,
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
import { HomePage } from '@/pages/HomePage'
import { HanaStartPage } from '@/pages/HanaStartPage'
import { HanaPage } from '@/pages/HanaPage'
import { GardenPage } from '@/pages/GardenPage'
import { StatsPage } from '@/pages/StatsPage'
import { QuestDetailPage } from '@/pages/QuestDetailPage'
import { EmotionHistoryPage } from '@/pages/EmotionHistoryPage'
import { CrambleExperience } from '@/features/cramble/CrambleExperience'
import { TogetherExperience } from '@/features/together/TogetherExperience'
import type {
  DailyEmotion,
  HanaGameState,
  NewOpenActivityInput,
} from '@/types'
import { useHabitReminders } from '@/hooks/useHabitReminders'
import { downloadProfileCsv } from '@/lib/habitExport'
import { millisecondsUntilNextLogicalDay } from '@/lib/logicalDay'
import { reconcileQuestGraduation } from '@/lib/questCompletion'
import { setDailyEmotion } from '@/lib/dailyEmotions'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'

type View =
  | 'home'
  | 'hanaStart'
  | 'hana'
  | 'garden'
  | 'stats'
  | 'questDetail'
  | 'emotionHistory'
  | 'cramble'
  | 'together'
type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline'
  | 'conflict'
  | 'disabled'
  | 'preview'
type HomeFocusTarget = 'hana' | 'cramble' | 'together' | null

const HANA_PENDING_STORAGE_KEY = 'hana-game/pending-v1'
const HANA_CONFLICT_BACKUP_KEY = 'hana-game/conflict-backup-v1'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [homeFocusTarget, setHomeFocusTarget] =
    useState<HomeFocusTarget>(null)
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [isExploringHana, setIsExploringHana] = useState(false)
  const [hanaGame, setHanaGame] = useState<HanaGameState | null>(null)
  const [homeLogicalDate, setHomeLogicalDate] = useState(() => todayKey())
  const [homeCrambleEmotion, setHomeCrambleEmotion] =
    useState<DailyEmotion | null>(null)
  useHabitReminders('hana', hanaGame, quests)
  const hanaGameRef = useRef<HanaGameState | null>(null)
  const pendingDbSaveRef = useRef<HanaGameState | null>(null)
  const isDbSaveInFlightRef = useRef(false)
  const syncConflictRef = useRef(false)
  const saveLoopPromiseRef = useRef<Promise<void> | null>(null)
  const hydrationSequenceRef = useRef(0)
  const localMutationRevisionRef = useRef(0)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(
    import.meta.env.DEV ? 'disabled' : 'loading',
  )
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null)

  useEffect(() => {
    hanaGameRef.current = hanaGame
  }, [hanaGame])

  const cacheHanaGame = useCallback((state: HanaGameState) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [])

  const clearHanaCache = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const cachePendingHanaGame = useCallback((state: HanaGameState) => {
    window.localStorage.setItem(
      HANA_PENDING_STORAGE_KEY,
      JSON.stringify(state),
    )
  }, [])

  const clearPendingHanaCache = useCallback(() => {
    window.localStorage.removeItem(HANA_PENDING_STORAGE_KEY)
  }, [])

  const clearPendingHanaCacheIfSaved = useCallback((state: HanaGameState) => {
    const pending = window.localStorage.getItem(HANA_PENDING_STORAGE_KEY)
    if (pending === JSON.stringify(state)) {
      window.localStorage.removeItem(HANA_PENDING_STORAGE_KEY)
    }
  }, [])

  const readCachedHanaGame = useCallback(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? parseStoredHanaState(saved, quests) : null
  }, [])

  const readPendingHanaGame = useCallback(() => {
    const saved = window.localStorage.getItem(HANA_PENDING_STORAGE_KEY)
    return saved ? parseStoredHanaState(saved, quests) : null
  }, [])

  const createInitialSyncedState = useCallback(
    () =>
      syncActiveQuestPlan(
        {
          ...createInitialHanaState(),
          currentDate: todayKey(),
        },
        quests,
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
          const saveResult = await saveHanaStateToDb(stateToSave, 'hana')

          if (!saveResult.ok) {
            pendingDbSaveRef.current ??= stateToSave
            syncConflictRef.current = Boolean(saveResult.conflict)
            setCloudSyncStatus(saveResult.conflict ? 'conflict' : 'error')
            return
          }

          clearPendingHanaCacheIfSaved(stateToSave)
          const baseRevision = stateToSave.syncRevision ?? 0
          const pending = pendingDbSaveRef.current as HanaGameState | null
          if (pending && (pending.syncRevision ?? 0) === baseRevision) {
            const revisedPending = {
              ...pending,
              syncRevision: saveResult.revision,
            }
            pendingDbSaveRef.current = revisedPending
            cachePendingHanaGame(revisedPending)
          }
          const latest = hanaGameRef.current
          if (latest && (latest.syncRevision ?? 0) === baseRevision) {
            const revisedLatest = {
              ...latest,
              syncRevision: saveResult.revision,
            }
            hanaGameRef.current = revisedLatest
            setHanaGame(revisedLatest)
            cacheHanaGame(revisedLatest)
          }
          setLastCloudSyncAt(saveResult.syncedAt)
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
  }, [
    cacheHanaGame,
    cachePendingHanaGame,
    clearPendingHanaCacheIfSaved,
  ])

  const hydrateFromDb = useCallback(
    async (silent = false) => {
      if (silent && (pendingDbSaveRef.current || isDbSaveInFlightRef.current)) {
        return false
      }

      const hydrationSequence = ++hydrationSequenceRef.current
      const mutationRevision = localMutationRevisionRef.current
      const initialState = createInitialSyncedState()
      const pendingState = readPendingHanaGame()

      if (pendingState && hasHanaStarted(pendingState)) {
        setHanaGame(pendingState)
        cacheHanaGame(pendingState)

        if (import.meta.env.DEV) {
          clearPendingHanaCache()
          setCloudSyncStatus('disabled')
          return true
        }

        pendingDbSaveRef.current = pendingState
        cachePendingHanaGame(pendingState)
        if (!navigator.onLine) {
          setCloudSyncStatus('offline')
          return false
        }

        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
        return !pendingDbSaveRef.current
      }

      if (pendingState) {
        clearPendingHanaCache()
      }

      if (import.meta.env.DEV) {
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState: readCachedHanaGame(),
          initialState,
        })
        setHanaGame(chosen.state)
        if (hasHanaStarted(chosen.state)) {
          cacheHanaGame(chosen.state)
        } else {
          clearHanaCache()
        }
        setCloudSyncStatus('disabled')
        return true
      }

      if (!navigator.onLine) {
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState: readCachedHanaGame(),
          initialState,
        })
        setHanaGame(chosen.state)
        if (hasHanaStarted(chosen.state)) {
          cacheHanaGame(chosen.state)
        } else {
          clearHanaCache()
        }
        if (!silent) {
          setCloudSyncStatus('offline')
        }
        return false
      }

      if (!silent) {
        setCloudSyncStatus('loading')
      }

      const remote = await loadHanaStateFromDb('hana')
      const hydrationIsStale =
        hydrationSequence !== hydrationSequenceRef.current ||
        mutationRevision !== localMutationRevisionRef.current ||
        Boolean(pendingDbSaveRef.current)
      if (hydrationIsStale) {
        return false
      }

      if (!remote.ok) {
        const fallbackState =
          hanaGameRef.current ?? readCachedHanaGame() ?? initialState
        setHanaGame(fallbackState)
        if (hasHanaStarted(fallbackState)) {
          cacheHanaGame(fallbackState)
        } else {
          clearHanaCache()
        }
        if (!silent) {
          setCloudSyncStatus('error')
        }
        return false
      }

      if (!remote.snapshot) {
        setHanaGame(initialState)
        clearHanaCache()
        clearPendingHanaCache()
        setLastCloudSyncAt(null)
        setCloudSyncStatus('idle')
        return true
      }

      const databaseState = {
        ...parseStoredHanaState(
          JSON.stringify(remote.snapshot.state),
          quests,
        ),
        syncRevision: remote.snapshot.revision ?? 0,
      }
      const chosen = chooseDbFirstState({
        databaseState,
        cachedState: readCachedHanaGame(),
        initialState,
      })
      const stateForToday = syncStateToDate(chosen.state, quests)

      if (!hasHanaStarted(stateForToday)) {
        const unstartedState = {
          ...initialState,
          syncRevision: remote.snapshot.revision ?? 0,
        }
        setHanaGame(unstartedState)
        clearHanaCache()
        clearPendingHanaCache()
        setCloudSyncStatus('idle')
        return true
      }

      setHanaGame(stateForToday)
      cacheHanaGame(stateForToday)

      if (remote.snapshot.currentDate !== stateForToday.currentDate) {
        pendingDbSaveRef.current = stateForToday
        cachePendingHanaGame(stateForToday)
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
      cacheHanaGame,
      cachePendingHanaGame,
      clearHanaCache,
      clearPendingHanaCache,
      createInitialSyncedState,
      flushQueuedDbSave,
      readCachedHanaGame,
      readPendingHanaGame,
    ],
  )

  const commitHanaState = useCallback(
    async (nextState: HanaGameState, silent = false) => {
      const stateForToday = syncStateToDate(nextState, quests, nextState.currentDate)

      if (!hasHanaStarted(stateForToday)) {
        hanaGameRef.current = stateForToday
        setHanaGame(stateForToday)
        setCloudSyncStatus('preview')
        return false
      }

      localMutationRevisionRef.current += 1
      hanaGameRef.current = stateForToday
      setHanaGame(stateForToday)
      cacheHanaGame(stateForToday)

      if (import.meta.env.DEV) {
        setCloudSyncStatus('disabled')
        return true
      }

      pendingDbSaveRef.current = stateForToday
      cachePendingHanaGame(stateForToday)
      if (!navigator.onLine) {
        setCloudSyncStatus('offline')
        return false
      }

      if (!silent) {
        setCloudSyncStatus('syncing')
      }

      void flushQueuedDbSave()
      return true
    },
    [cacheHanaGame, cachePendingHanaGame, flushQueuedDbSave],
  )

  const refreshHanaFromDb = useCallback(async () => {
    if (syncConflictRef.current) {
      const localState = hanaGameRef.current
      const shouldLoadDatabase = window.confirm(
        'This profile changed on another device. Load the database copy now? Your current local copy will be downloaded as CSV and kept as a JSON recovery backup first.',
      )
      if (!shouldLoadDatabase) return false
      if (localState) {
        downloadProfileCsv(localState, quests, 'hana')
        window.localStorage.setItem(
          HANA_CONFLICT_BACKUP_KEY,
          JSON.stringify(localState),
        )
      }
      pendingDbSaveRef.current = null
      clearPendingHanaCache()
      syncConflictRef.current = false
      return hydrateFromDb(false)
    }
    if (pendingDbSaveRef.current || isDbSaveInFlightRef.current) {
      setCloudSyncStatus('syncing')
      await flushQueuedDbSave()
      if (pendingDbSaveRef.current) {
        return false
      }
    }

    return hydrateFromDb(false)
  }, [clearPendingHanaCache, flushQueuedDbSave, hydrateFromDb])

  useEffect(() => {
    void hydrateFromDb()
  }, [hydrateFromDb])

  useEffect(() => {
    let rolloverTimer: number | null = null
    const syncToToday = () => {
      const currentDate = todayKey()
      setHomeLogicalDate(currentDate)
      const previousState = hanaGameRef.current
      if (!previousState || !hasHanaStarted(previousState)) {
        return
      }

      if (import.meta.env.DEV && previousState.currentDate > currentDate) {
        return
      }
      if (previousState.currentDate !== currentDate) {
        void commitHanaState(syncStateToDate(previousState, quests, currentDate), true)
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
  }, [commitHanaState])

  useEffect(() => {
    if (view !== 'home') return undefined
    let cancelled = false

    const finish = (emotion: DailyEmotion | null) => {
      if (!cancelled) setHomeCrambleEmotion(emotion)
    }
    const readStoredState = (key: string) => {
      const saved = window.localStorage.getItem(key)
      return saved
        ? parseStoredHanaState(
            saved,
            crambleQuests,
            homeLogicalDate,
            CRAMBLE_QUEST_PLAN_OPTIONS,
          )
        : null
    }
    const load = async () => {
      const pending = readStoredState(CRAMBLE_PENDING_STORAGE_KEY)
      if (pending && hasHanaStarted(pending)) {
        finish(pending.dailyEmotions[homeLogicalDate] ?? null)
        return
      }

      const cached = readStoredState(CRAMBLE_STORAGE_KEY)
      finish(cached?.dailyEmotions[homeLogicalDate] ?? null)
      if (import.meta.env.DEV || !navigator.onLine) return

      const remote = await loadHanaStateFromDb('cramble')
      if (!remote.ok || !remote.snapshot) return
      const databaseState = parseStoredHanaState(
        JSON.stringify(remote.snapshot.state),
        crambleQuests,
        homeLogicalDate,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      )
      finish(databaseState.dailyEmotions[homeLogicalDate] ?? null)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [homeLogicalDate, view])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return undefined
    }

    const refreshSilently = () => void hydrateFromDb(true)
    const refreshAfterReconnect = async () => {
      const pendingState = pendingDbSaveRef.current ?? readPendingHanaGame()
      if (pendingState && hasHanaStarted(pendingState)) {
        pendingDbSaveRef.current = pendingState
        cachePendingHanaGame(pendingState)
        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
      }
      if (!pendingDbSaveRef.current) {
        await hydrateFromDb(true)
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently()
      }
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
    cachePendingHanaGame,
    flushQueuedDbSave,
    hydrateFromDb,
    readPendingHanaGame,
  ])

  const toggleHana = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

    const catalog = getQuestCatalog(quests, previousState)
    const quest = catalog.find((item) => item.id === id)
    if (!quest) {
      return
    }

    const nextState = toggleQuestCompletion(previousState, quest)
    const withUpdatedFlowers = {
      ...nextState,
      totalFlowers: recomputeTotalFlowers(nextState, catalog),
    }

    void commitHanaState(
      reconcileQuestGraduation(
        withUpdatedFlowers,
        quests,
        'hana',
        quest,
      ),
    )
  }

  const undoHanaOccurrence = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

    const catalog = getQuestCatalog(quests, previousState)
    const quest = catalog.find((item) => item.id === id)
    if (!quest || quest.schedule?.kind !== 'periodTarget') {
      return
    }

    const nextState = undoQuestCompletion(previousState, quest)
    if (nextState === previousState) {
      return
    }

    const withUpdatedFlowers = {
      ...nextState,
      totalFlowers: recomputeTotalFlowers(nextState, catalog),
    }
    void commitHanaState(
      reconcileQuestGraduation(
        withUpdatedFlowers,
        quests,
        'hana',
        quest,
      ),
    )
  }

  const toggleWeed = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }
    if (getActiveProfilePause(previousState)) return

    const eveningWeeds = previousState.eveningWeeds ?? {}
    const currentWeeds = eveningWeeds[previousState.currentDate] ?? {}
    const nextState: HanaGameState = {
      ...previousState,
      eveningWeeds: {
        ...eveningWeeds,
        [previousState.currentDate]: {
          ...currentWeeds,
          [id]: !currentWeeds[id],
        },
      },
    }

    void commitHanaState({
      ...nextState,
      totalFlowers: recomputeTotalFlowers(nextState, quests),
    })
  }

  const toggleSkip = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

    const quest = getQuestCatalog(quests, previousState).find(
      (item) => item.id === id,
    )
    if (!quest) {
      return
    }

    const skipKey = getSkipEventKey(previousState, quest)
    const storedWeekKey = Object.entries(previousState.questSkips ?? {}).find(
      ([, skips]) => skips[skipKey] === true,
    )?.[0]
    const weekKey = storedWeekKey ?? getSkipWeekKey(previousState.currentDate)
    const skipsThisWeek = previousState.questSkips?.[weekKey] ?? {}
    const isSkipped = Boolean(skipsThisWeek[skipKey])
    const skipProgress = getSkipProgress(previousState)

    if (!isSkipped && skipProgress.remaining <= 0) {
      return
    }

    void commitHanaState({
      ...previousState,
      questSkips: {
        ...(previousState.questSkips ?? {}),
        [weekKey]: {
          ...skipsThisWeek,
          [skipKey]: !isSkipped,
        },
      },
    })
  }

  const addHanaHabit = (input: NewHabitInput) => {
    const previousState = hanaGameRef.current
    if (!previousState || !hasHanaStarted(previousState)) {
      return "Start Hana's Health Overhaul before adding a habit."
    }

    const catalog = getQuestCatalog(quests, previousState)
    const existingTitles = catalog.map((quest) => quest.title)
    const validationError = getNewHabitValidationError(input, existingTitles)
    if (validationError) {
      return validationError
    }

    const customHabit = createCustomHabitQuest(
      input,
      'hana',
      previousState.currentDate,
      existingTitles,
    )
    const withHabit: HanaGameState = {
      ...previousState,
      customHabits: [...previousState.customHabits, customHabit],
      questActivations: {
        ...(previousState.questActivations ?? {}),
        [customHabit.id]: addDays(previousState.currentDate, 1),
      },
    }
    void commitHanaState(
      updateHabitPreferences(withHabit, customHabit.id, {
        cue: input.cue ?? '',
        reminderTime: input.reminderTime ?? null,
      }),
    )
    return null
  }

  const editHanaHabit = (habitId: string, input: NewHabitInput) => {
    const previousState = hanaGameRef.current
    if (!previousState) return 'Hana’s tracker is not ready.'
    const catalog = getQuestCatalog(quests, previousState)
    const habit = previousState.customHabits.find((item) => item.id === habitId)
    const existingTitles = catalog
      .filter((quest) => quest.id !== habitId)
      .map((quest) => quest.title)
    const validationError = getNewHabitValidationError(input, existingTitles)
    if (validationError) return validationError
    if (!habit) {
      if (!catalog.some((quest) => quest.id === habitId)) {
        return 'That habit is unavailable.'
      }
      const withWording = updateHabitWording(previousState, habitId, input)
      void commitHanaState(
        updateHabitPreferences(withWording, habitId, {
          cue: input.cue ?? '',
          reminderTime: input.reminderTime ?? null,
        }),
      )
      return null
    }
    if (
      hasHabitHistory(previousState, habitId) &&
      !hasSameHabitScoringRules(habit, input)
    ) {
      return 'Frequency and effort cannot change after tracking begins. Archive this habit and add its new rhythm instead.'
    }

    const updatedHabit = updateCustomHabitQuest(habit, input, existingTitles)
    const withDefinition: HanaGameState = {
      ...previousState,
      customHabits: previousState.customHabits.map((item) =>
        item.id === habitId ? updatedHabit : item,
      ),
    }
    void commitHanaState(
      updateHabitPreferences(withDefinition, habitId, {
        cue: input.cue ?? '',
        reminderTime: input.reminderTime ?? null,
      }),
    )
    return null
  }

  const addHanaOpenActivity = (input: NewOpenActivityInput) => {
    const previousState = hanaGameRef.current
    if (!previousState || !hasHanaStarted(previousState)) {
      return "Start Hana's Health Overhaul before adding an anytime log."
    }
    if (previousState.openActivities.length >= OPEN_ACTIVITY_LIMITS.definitions) {
      return 'This profile has reached its anytime-log limit.'
    }

    const existingTitles = [
      ...getQuestCatalog(quests, previousState).map((quest) => quest.title),
      ...previousState.openActivities.map((activity) => activity.title),
    ]
    const validationError = getNewOpenActivityValidationError(
      input,
      existingTitles,
    )
    if (validationError) return validationError

    try {
      const activity = createOpenActivity(
        input,
        'hana',
        previousState.currentDate,
        existingTitles,
      )
      void commitHanaState({
        ...previousState,
        openActivities: [...previousState.openActivities, activity],
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not add this anytime log.'
    }
  }

  const editHanaOpenActivity = (
    activityId: string,
    input: NewOpenActivityInput,
  ) => {
    const previousState = hanaGameRef.current
    if (!previousState) return "Hana's tracker is not ready."
    const activity = previousState.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (!activity) return 'That anytime log is unavailable.'

    const existingTitles = [
      ...getQuestCatalog(quests, previousState).map((quest) => quest.title),
      ...previousState.openActivities
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
      hasOpenActivityHistory(previousState, activityId) &&
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
      void commitHanaState({
        ...previousState,
        openActivities: previousState.openActivities.map((candidate) =>
          candidate.id === activityId ? updated : candidate,
        ),
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update this anytime log.'
    }
  }

  const changeHanaOpenActivity = (activityId: string, delta: 1 | -1) => {
    const previousState = hanaGameRef.current
    if (!previousState) return
    const activity = previousState.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (!activity) return

    const nextState =
      activity.kind === 'check'
        ? setOpenActivityValueForDate(
            previousState,
            activityId,
            previousState.currentDate,
            delta > 0 ? 1 : 0,
          )
        : incrementOpenActivityCountForDate(
            previousState,
            activityId,
            previousState.currentDate,
            delta,
          )
    if (nextState !== previousState) void commitHanaState(nextState)
  }

  const setHanaOpenActivityRating = (activityId: string, rating: number) => {
    const previousState = hanaGameRef.current
    if (!previousState) return
    const activity = previousState.openActivities.find(
      (candidate) => candidate.id === activityId,
    )
    if (activity?.kind !== 'rating') return
    const nextState = setOpenActivityValueForDate(
      previousState,
      activityId,
      previousState.currentDate,
      rating,
    )
    if (nextState !== previousState) void commitHanaState(nextState)
  }

  const setHanaEmotion = (emotion: DailyEmotion) => {
    const previousState = hanaGameRef.current
    if (!previousState || getActiveProfilePause(previousState)) return
    const nextState = setDailyEmotion(previousState, emotion)
    if (nextState !== previousState) void commitHanaState(nextState)
  }

  const pauseHanaHabit = (habitId: string, input: PauseInput) => {
    const previousState = hanaGameRef.current
    if (previousState) void commitHanaState(startHabitPause(previousState, habitId, input))
  }

  const resumeHanaHabit = (habitId: string) => {
    const previousState = hanaGameRef.current
    if (previousState) void commitHanaState(resumeHabitTracking(previousState, habitId))
  }

  const archiveHanaHabit = (habitId: string) => {
    const previousState = hanaGameRef.current
    if (previousState) void commitHanaState(archiveHabit(previousState, habitId))
  }

  const restoreHanaHabit = (habitId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return
    void commitHanaState(
      isHabitGraduatedOnDate(previousState, habitId)
        ? restoreGraduatedHabit(previousState, habitId)
        : restoreHabit(previousState, habitId),
    )
  }

  const activateHanaQuest = (habitId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return
    const quest = getQuestCatalog(quests, previousState).find(
      (candidate) => candidate.id === habitId,
    )
    if (!quest) return
    void commitHanaState(activateQuest(previousState, quest))
  }

  const deleteHanaHabit = (habitId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return
    const purged = deleteHabitPermanently(previousState, habitId)
    const catalog = getQuestCatalog(quests, purged)
    void commitHanaState({
      ...purged,
      totalFlowers: recomputeTotalFlowers(purged, catalog),
    })
  }

  const pauseAllHana = (input: PauseInput) => {
    const previousState = hanaGameRef.current
    if (previousState) void commitHanaState(startProfilePause(previousState, input))
  }

  const resumeAllHana = () => {
    const previousState = hanaGameRef.current
    if (previousState) void commitHanaState(resumeProfileTracking(previousState))
  }

  const backfillHana = (dateKey: string, habitId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return 'Hana’s tracker is not ready.'
    const catalog = getQuestCatalog(quests, previousState)
    const quest = catalog.find((item) => item.id === habitId)
    if (!quest) return 'That habit is unavailable.'
    const result = recordQuestCompletionForDate(previousState, quest, dateKey)
    if (result.error) return result.error
    const withUpdatedFlowers = {
      ...result.state,
      totalFlowers: recomputeTotalFlowers(result.state, catalog),
    }
    void commitHanaState(
      reconcileQuestGraduation(
        withUpdatedFlowers,
        quests,
        'hana',
        quest,
      ),
    )
    return null
  }

  const undoBackfillHana = (dateKey: string, habitId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return "Hana's tracker is not ready."
    const catalog = getQuestCatalog(quests, previousState)
    const quest = catalog.find((item) => item.id === habitId)
    if (!quest) return 'That habit is unavailable.'
    const result = undoQuestCompletionForDate(previousState, quest, dateKey)
    if (result.error) return result.error
    const withUpdatedFlowers = {
      ...result.state,
      totalFlowers: recomputeTotalFlowers(result.state, catalog),
    }
    void commitHanaState(
      reconcileQuestGraduation(
        withUpdatedFlowers,
        quests,
        'hana',
        quest,
      ),
    )
    return null
  }

  const backfillHanaOpenActivity = (dateKey: string, activityId: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) return "Hana's tracker is not ready."
    const result = recordOpenActivityForDate(
      previousState,
      activityId,
      dateKey,
    )
    if (result.error) return result.error
    void commitHanaState(result.state)
    return result.error
  }

  const undoBackfillHanaOpenActivity = (
    dateKey: string,
    activityId: string,
  ) => {
    const previousState = hanaGameRef.current
    if (!previousState) return "Hana's tracker is not ready."
    const result = undoOpenActivityForDate(
      previousState,
      activityId,
      dateKey,
    )
    if (result.error) return result.error
    void commitHanaState(result.state)
    return result.error
  }

  const goToNextDay = () => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

    void commitHanaState(
      syncActiveQuestPlan(
        {
          ...previousState,
          currentDate: addDays(previousState.currentDate, 1),
        },
        quests,
      ),
    )
  }

  const resetHana = () => {
    clearHanaCache()
    const previousState = hanaGameRef.current
    if (!previousState) return
    void commitHanaState(resetProfileProgress(previousState, quests))
  }

  const startHanaToday = async () => {
    const startDate = todayKey()
    const startedState = {
      ...syncStateToDate(createStartedHanaState(startDate), quests, startDate),
      syncRevision: hanaGameRef.current?.syncRevision ?? 0,
    }

    setIsExploringHana(false)

    if (import.meta.env.DEV) {
      localMutationRevisionRef.current += 1
      clearHanaCache()
      clearPendingHanaCache()
      pendingDbSaveRef.current = null
      setHanaGame(startedState)
      cacheHanaGame(startedState)
      setCloudSyncStatus('disabled')
      setView('hana')
      return
    }

    if (!navigator.onLine) {
      setCloudSyncStatus('offline')
      return
    }

    setCloudSyncStatus('syncing')
    const saveResult = await saveHanaStateToDb(startedState, 'hana')
    if (!saveResult.ok) {
      setCloudSyncStatus(saveResult.conflict ? 'conflict' : 'error')
      return
    }

    localMutationRevisionRef.current += 1
    const syncedStartedState = {
      ...startedState,
      syncRevision: saveResult.revision,
    }
    hanaGameRef.current = syncedStartedState
    setHanaGame(syncedStartedState)
    clearHanaCache()
    clearPendingHanaCache()
    pendingDbSaveRef.current = null
    cacheHanaGame(syncedStartedState)
    setLastCloudSyncAt(saveResult.syncedAt)
    setCloudSyncStatus('synced')
    syncConflictRef.current = false
    setView('hana')
  }

  const exploreHana = () => {
    setIsExploringHana(true)
    setCloudSyncStatus('preview')
    setHanaGame(syncActiveQuestPlan(createInitialHanaState(), quests))
    setView('hana')
  }

  const openHana = () => {
    setIsExploringHana(false)
    const currentGame = hanaGameRef.current
    setView(currentGame && !hasHanaStarted(currentGame) ? 'hanaStart' : 'hana')
  }

  if (view === 'hanaStart') {
    if (hanaGame && hasHanaStarted(hanaGame)) {
      return (
        <HanaPage
          game={hanaGame}
          onToggle={toggleHana}
          onUndoOccurrence={undoHanaOccurrence}
          onAddHabit={addHanaHabit}
          onEditHabit={editHanaHabit}
          onAddOpenActivity={addHanaOpenActivity}
          onEditOpenActivity={editHanaOpenActivity}
          onIncrementOpenActivity={(activityId) =>
            changeHanaOpenActivity(activityId, 1)
          }
          onDecrementOpenActivity={(activityId) =>
            changeHanaOpenActivity(activityId, -1)
          }
          onSetOpenActivityRating={setHanaOpenActivityRating}
          onSetDailyEmotion={setHanaEmotion}
          onPauseHabit={pauseHanaHabit}
          onResumeHabit={resumeHanaHabit}
          onArchiveHabit={archiveHanaHabit}
          onRestoreHabit={restoreHanaHabit}
          onDeleteHabit={deleteHanaHabit}
          onPauseTracking={pauseAllHana}
          onResumeTracking={resumeAllHana}
          onBackfill={backfillHana}
          onUndoBackfill={undoBackfillHana}
          onBackfillOpenActivity={backfillHanaOpenActivity}
          onUndoBackfillOpenActivity={undoBackfillHanaOpenActivity}
          onSkip={toggleSkip}
          onActivateQuest={activateHanaQuest}
          onToggleWeed={toggleWeed}
          onOpenGarden={() => setView('garden')}
          onOpenLedger={() => setView('stats')}
          onNextDay={goToNextDay}
          onReset={resetHana}
          onSyncCloud={() => void refreshHanaFromDb()}
          cloudSyncStatus={cloudSyncStatus}
          lastCloudSyncAt={lastCloudSyncAt}
          onBack={() => {
            setIsExploringHana(false)
            setView('home')
          }}
        />
      )
    }

    return hanaGame ? (
      <HanaStartPage
        onBack={() => setView('home')}
        onStart={() => void startHanaToday()}
        onExplore={exploreHana}
        isSaving={cloudSyncStatus === 'syncing'}
        statusText={getStartPageStatus(cloudSyncStatus)}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'hana') {
    if (hanaGame && !hasHanaStarted(hanaGame) && !isExploringHana) {
      return (
        <HanaStartPage
          onBack={() => setView('home')}
          onStart={() => void startHanaToday()}
          onExplore={exploreHana}
          isSaving={cloudSyncStatus === 'syncing'}
          statusText={getStartPageStatus(cloudSyncStatus)}
        />
      )
    }

    return hanaGame ? (
      <HanaPage
        game={hanaGame}
        onToggle={toggleHana}
        onUndoOccurrence={undoHanaOccurrence}
        onAddHabit={addHanaHabit}
        onEditHabit={editHanaHabit}
        onAddOpenActivity={addHanaOpenActivity}
        onEditOpenActivity={editHanaOpenActivity}
        onIncrementOpenActivity={(activityId) =>
          changeHanaOpenActivity(activityId, 1)
        }
        onDecrementOpenActivity={(activityId) =>
          changeHanaOpenActivity(activityId, -1)
        }
        onSetOpenActivityRating={setHanaOpenActivityRating}
        onSetDailyEmotion={setHanaEmotion}
        onPauseHabit={pauseHanaHabit}
        onResumeHabit={resumeHanaHabit}
        onArchiveHabit={archiveHanaHabit}
        onRestoreHabit={restoreHanaHabit}
        onDeleteHabit={deleteHanaHabit}
        onPauseTracking={pauseAllHana}
        onResumeTracking={resumeAllHana}
        onBackfill={backfillHana}
        onUndoBackfill={undoBackfillHana}
        onBackfillOpenActivity={backfillHanaOpenActivity}
        onUndoBackfillOpenActivity={undoBackfillHanaOpenActivity}
        onSkip={toggleSkip}
        onActivateQuest={activateHanaQuest}
        onToggleWeed={toggleWeed}
        onOpenGarden={() => setView('garden')}
        onOpenLedger={() => setView('stats')}
        onNextDay={goToNextDay}
        onReset={resetHana}
        onSyncCloud={() => void refreshHanaFromDb()}
        cloudSyncStatus={cloudSyncStatus}
        lastCloudSyncAt={lastCloudSyncAt}
        onBack={() => {
          setIsExploringHana(false)
          setView('home')
        }}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'garden') {
    return hanaGame ? (
      <GardenPage game={hanaGame} onBack={() => setView('hana')} />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'stats') {
    return hanaGame ? (
      <StatsPage
        game={hanaGame}
        onBack={() => setView('hana')}
        onRestoreHabit={restoreHanaHabit}
        onDeleteHabit={deleteHanaHabit}
        onOpenQuest={(questId) => {
          setSelectedQuestId(questId)
          setView('questDetail')
        }}
        onOpenEmotion={() => setView('emotionHistory')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'questDetail') {
    return hanaGame && selectedQuestId ? (
      <QuestDetailPage
        game={hanaGame}
        questId={selectedQuestId}
        onBack={() => setView('stats')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'emotionHistory') {
    return hanaGame ? (
      <EmotionHistoryPage
        game={hanaGame}
        profileId="hana"
        onBack={() => setView('stats')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'cramble') {
    return <CrambleExperience onBack={() => setView('home')} />
  }

  if (view === 'together') {
    return (
      <TogetherExperience
        hanaGame={hanaGame}
        onBack={() => {
          setHomeFocusTarget('together')
          setView('home')
        }}
      />
    )
  }

  return (
    <HomePage
      focusTarget={homeFocusTarget}
      hanaEmotion={hanaGame?.dailyEmotions[homeLogicalDate] ?? null}
      crambleEmotion={homeCrambleEmotion}
      onSelectHana={() => {
        setHomeFocusTarget('hana')
        openHana()
      }}
      onSelectCramble={() => {
        setHomeFocusTarget('cramble')
        setView('cramble')
      }}
      onSelectTogether={() => {
        setHomeFocusTarget('together')
        setView('together')
      }}
    />
  )
}
function HanaLoadingPage({
  status,
  onBack,
}: {
  status: CloudSyncStatus
  onBack: () => void
}) {
  return (
    <div className="hana-spring-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        aria-label="Back to home"
      >
        Back
      </button>
      <div className="grid flex-1 place-items-center text-center">
        <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
          <FlowerMark className="mx-auto size-14 flower-pulse" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
            Opening Hana's garden
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {status === 'offline'
              ? 'Offline right now. Using the saved garden cache.'
              : 'Loading the latest garden from the database.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function getStartPageStatus(status: CloudSyncStatus) {
  if (status === 'syncing') {
    return 'Clearing the old garden and saving today as Hana\'s first day...'
  }
  if (status === 'offline') {
    return 'Starting needs internet once, so today can be saved to the database.'
  }
  if (status === 'error') {
    return 'Could not prepare the database yet. Please try again in a moment.'
  }
  if (status === 'preview') {
    return 'Preview mode is open. It will not save progress until Start Health Overhaul is pressed.'
  }
  return 'Explore is okay. Start only when Hana is ready to commit.'
}
