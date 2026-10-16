import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, Compass } from 'lucide-react'
import { CrambleBackground } from '@/components/CrambleBackground'
import { crambleQuests } from '@/data/crambleQuests'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import {
  addDays,
  createInitialHanaState,
  createStartedHanaState,
  hasHanaStarted,
  parseStoredHanaState,
  resetProfileProgress,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
} from '@/lib/hanaGame'
import {
  archiveHabit,
  deleteHabitPermanently,
  getActiveProfilePause,
  isHabitGraduatedOnDate,
  restoreHabit,
  restoreGraduatedHabit,
  resumeHabitTracking,
  resumeProfileTracking,
  startHabitPause,
  startProfilePause,
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
import { LifetimePage } from '@/pages/LifetimePage'
import { changeLifetime } from '@/lib/lifetime'
import { CrambleSomedayPage } from '@/pages/CrambleSomedayPage'
import { assignSomedayCategory, changeSomedayCategory, getSomedayCategories, type SomedayCategoryChange } from '@/lib/somedayCategories'
import { EmotionHistoryPage } from '@/pages/EmotionHistoryPage'
import type {
  DailyEmotion,
  HanaGameState,
  NewSomedayItemInput,
  NewOpenActivityInput,
} from '@/types'
import {
  addSomedayItem as appendSomedayItem,
  deleteSomedayItem,
  toggleSomedayItem,
  updateSomedayItem,
} from '@/lib/someday'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { millisecondsUntilNextLogicalDay } from '@/lib/logicalDay'
import { recordRecentEmotion, setDailyEmotion } from '@/lib/dailyEmotions'
import {
  advancePendingProfileSyncRevision,
  markPendingProfileSyncAttempted,
  parsePendingProfileSync,
  queuePendingProfileSync,
  rebasePendingProfileSync,
  serializePendingProfileSync,
  type PendingProfileSync,
} from '@/lib/profileSync'
import { readLocalProfileState } from '@/lib/profileCache'
import { RhythmPage } from '@/pages/RhythmPage'
import { assignRhythmCategory, createRhythmCategory, getRhythmSettings } from '@/lib/rhythmCategories'
import { getRhythmTrackers } from '@/lib/rhythmStats'
import { CrambleNavigation } from '@/components/CrambleNavigation'
import { useCrambleNavigation } from '@/hooks/useCrambleNavigation'
import { CrambleSettings, CrambleSettingsContext, CrambleSharedSyncContext } from '@/components/CrambleSettings'
import { CloudSyncNotice } from '@/components/CloudSyncNotice'
import { downloadProfileJson } from '@/lib/habitExport'
import { changeRhythmCategory } from '@/lib/rhythmCategories'

type Props = {
  onBack?: () => void
}

export function CrambleExperience({ onBack }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { route, navigate: setView, back } = useCrambleNavigation(onBack)
  const { view, questId: selectedQuestId } = route
  const [initialLocal] = useState(() => readLocalProfileState('cramble'))
  const [game, setGame] = useState<HanaGameState | null>(
    initialLocal?.state ?? null,
  )
  const gameRef = useRef<HanaGameState | null>(game)
  const pendingDbSaveRef = useRef<PendingProfileSync | null>(
    initialLocal?.pending ?? null,
  )
  const isDbSaveInFlightRef = useRef(false)
  const syncConflictRef = useRef(false)
  const saveLoopPromiseRef = useRef<Promise<void> | null>(null)
  const hydrationSequenceRef = useRef(0)
  const localMutationRevisionRef = useRef(0)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CrambleSyncStatus>(
    import.meta.env.DEV ? 'disabled' : 'loading',
  )
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null)
  const [saveConfirmedAt, setSaveConfirmedAt] = useState<number | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const cacheGame = useCallback((state: HanaGameState) => {
    window.localStorage.setItem(CRAMBLE_STORAGE_KEY, JSON.stringify(state))
  }, [])

  const clearCache = useCallback(() => {
    window.localStorage.removeItem(CRAMBLE_STORAGE_KEY)
  }, [])

  const cachePendingGame = useCallback((pending: PendingProfileSync) => {
    window.localStorage.setItem(
      CRAMBLE_PENDING_STORAGE_KEY,
      serializePendingProfileSync(pending),
    )
  }, [])

  const clearPendingCache = useCallback(() => {
    window.localStorage.removeItem(CRAMBLE_PENDING_STORAGE_KEY)
  }, [])

  const clearPendingCacheIfSaved = useCallback((writeToken: string) => {
    const raw = window.localStorage.getItem(CRAMBLE_PENDING_STORAGE_KEY)
    if (!raw) return
    try {
      const pending = JSON.parse(raw) as { writeToken?: unknown }
      if (pending.writeToken !== writeToken) return
      window.localStorage.removeItem(CRAMBLE_PENDING_STORAGE_KEY)
    } catch {
      // Legacy state-only caches do not carry an acknowledgement token.
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
    return parsePendingProfileSync(saved, (raw) =>
      parseStoredHanaState(
          raw,
          crambleQuests,
          todayKey(),
          CRAMBLE_QUEST_PLAN_OPTIONS,
        ),
    )
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
      let conflictRebases = 0
      let didSave = false
      try {
        while (pendingDbSaveRef.current) {
          const queued = markPendingProfileSyncAttempted(
            pendingDbSaveRef.current,
          )
          pendingDbSaveRef.current = null
          cachePendingGame(queued)
          const stateToSave = queued.state
          const result = await saveProfileStateToDb(
            stateToSave,
            'cramble',
            crambleQuests,
            fetch,
            queued.writeToken,
          )

          if (!result.ok) {
            if (result.conflict && conflictRebases < 3) {
              const remote = await loadHanaStateFromDb('cramble')
              if (remote.ok && remote.snapshot) {
                const databaseState = {
                  ...parseStoredHanaState(
                    JSON.stringify(remote.snapshot.state),
                    crambleQuests,
                    todayKey(),
                    CRAMBLE_QUEST_PLAN_OPTIONS,
                  ),
                  syncRevision: remote.snapshot.revision ?? 0,
                }
                const rebased = rebasePendingProfileSync(
                  queued,
                  databaseState,
                  remote.snapshot.revision ?? 0,
                )
                if (rebased) {
                  const stateForToday = syncStateToDate(
                    rebased.state,
                    crambleQuests,
                    todayKey(),
                    CRAMBLE_QUEST_PLAN_OPTIONS,
                  )
                  const recovered = {
                    ...rebased,
                    state: {
                      ...stateForToday,
                      totalFlowers: stateForToday.totalFlowers,
                    },
                  }
                  pendingDbSaveRef.current = recovered
                  cachePendingGame(recovered)
                  gameRef.current = recovered.state
                  setGame(recovered.state)
                  cacheGame(recovered.state)
                  conflictRebases += 1
                  setCloudSyncStatus('syncing')
                  continue
                }
              }
            }

            pendingDbSaveRef.current ??= queued
            cachePendingGame(pendingDbSaveRef.current)
            syncConflictRef.current = Boolean(result.conflict)
            setCloudSyncStatus(result.conflict ? 'conflict' : 'error')
            return
          }

          clearPendingCacheIfSaved(queued.writeToken)
          const baseRevision = stateToSave.syncRevision ?? 0
          const pending = pendingDbSaveRef.current
          if (pending) {
            const revisedPending = advancePendingProfileSyncRevision(
              pending,
              baseRevision,
              result.revision,
            )
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
          didSave = true
          conflictRebases = 0
        }
        setCloudSyncStatus('synced')
        syncConflictRef.current = false
        if (didSave) {
          setSaveConfirmedAt(Date.now())
        }
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
      const pending = readPendingGame()

      if (pending && hasHanaStarted(pending.state)) {
        setGame(pending.state)
        cacheGame(pending.state)

        if (import.meta.env.DEV) {
          clearPendingCache()
          setCloudSyncStatus('disabled')
          return true
        }

        pendingDbSaveRef.current = pending
        cachePendingGame(pending)
        if (!navigator.onLine) {
          setCloudSyncStatus('offline')
          return false
        }

        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
        return !pendingDbSaveRef.current
      }

      if (pending) {
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
        const recoverableState = gameRef.current ?? readCachedGame()
        if (recoverableState && hasHanaStarted(recoverableState)) {
          const stateForToday = {
            ...syncStateToDate(
              recoverableState,
              crambleQuests,
              todayKey(),
              CRAMBLE_QUEST_PLAN_OPTIONS,
            ),
            syncRevision: 0,
          }
          const pending = queuePendingProfileSync(
            { ...initialState, syncRevision: 0 },
            stateForToday,
            null,
          )
          pendingDbSaveRef.current = pending
          cachePendingGame(pending)
          gameRef.current = stateForToday
          setGame(stateForToday)
          cacheGame(stateForToday)
          setCloudSyncStatus('syncing')
          await flushQueuedDbSave()
          return !pendingDbSaveRef.current
        }

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
        const pending = queuePendingProfileSync(
          chosen.state,
          stateForToday,
          null,
        )
        pendingDbSaveRef.current = pending
        cachePendingGame(pending)
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
      const previousState = gameRef.current ?? nextState
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

      const pending = queuePendingProfileSync(
        previousState,
        stateForToday,
        pendingDbSaveRef.current,
      )
      pendingDbSaveRef.current = pending
      cachePendingGame(pending)
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
    if (pendingDbSaveRef.current || isDbSaveInFlightRef.current) {
      setCloudSyncStatus('syncing')
      await flushQueuedDbSave()
      if (pendingDbSaveRef.current) return false
    }
    return hydrateFromDb(false)
  }, [flushQueuedDbSave, hydrateFromDb])

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

    const flushPendingThenRefresh = async () => {
      const pending = pendingDbSaveRef.current ?? readPendingGame()
      if (pending && hasHanaStarted(pending.state)) {
        pendingDbSaveRef.current = pending
        cachePendingGame(pending)
        setCloudSyncStatus('syncing')
        await flushQueuedDbSave()
      }
      if (!pendingDbSaveRef.current) await hydrateFromDb(true)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void flushPendingThenRefresh()
      }
    }
    const retryTimer = window.setInterval(() => {
      if (navigator.onLine && pendingDbSaveRef.current) {
        void flushPendingThenRefresh()
      }
    }, 30_000)

    window.addEventListener('focus', flushPendingThenRefresh)
    window.addEventListener('online', flushPendingThenRefresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', flushPendingThenRefresh)
      window.removeEventListener('online', flushPendingThenRefresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(retryTimer)
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
    setSaveConfirmedAt(Date.now())
    syncConflictRef.current = false
  }


  const addCrambleHabit = () => 'Observatory is disabled.'


  const addCrambleOpenActivity = (input: NewOpenActivityInput) => {
    const previous = gameRef.current
    if (!previous || !hasHanaStarted(previous)) {
      return "Begin Cramble's First Oath before adding an anytime log."
    }
    if (previous.openActivities.length >= OPEN_ACTIVITY_LIMITS.definitions) {
      return 'This profile has reached its anytime-log limit.'
    }

    const existingTitles = [
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
      const withActivity = {
        ...previous,
        openActivities: [...previous.openActivities, activity],
      }
      const categorized = assignRhythmCategory({ ...withActivity, rhythm: getRhythmSettings(previous, getRhythmTrackers(previous, crambleQuests)) }, activity.id, input.categoryId ?? null)
      if (categorized.error) return categorized.error
      void commitGameState(categorized.state)
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
      const withActivity = {
        ...previous,
        openActivities: previous.openActivities.map((candidate) =>
          candidate.id === activityId ? updated : candidate,
        ),
      }
      const rhythm = getRhythmSettings(previous, getRhythmTrackers(previous, crambleQuests))
      const categorized = assignRhythmCategory({ ...withActivity, rhythm }, activityId, input.categoryId === undefined ? rhythm.assignments[activityId] ?? null : input.categoryId)
      if (categorized.error) return categorized.error
      void commitGameState(categorized.state)
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

  const recordCrambleRecentEmotion = (dateKey: string, emotion: DailyEmotion) => {
    const previous = gameRef.current
    if (!previous) return 'Cramble is not ready yet.'
    const result = recordRecentEmotion(previous, dateKey, emotion)
    if (!result.error && result.state !== previous) void commitGameState(result.state)
    return result.error
  }

  const addCrambleSomedayItem = (input: NewSomedayItemInput) => {
    const previous = gameRef.current
    if (!previous || !hasHanaStarted(previous)) {
      return "Begin Cramble's First Oath before adding to Someday."
    }
    const result = appendSomedayItem(previous, input)
    if (result.error) return result.error
    const assigned = assignSomedayCategory(result.state, result.state.somedayItems!.at(-1)!.id, input.categoryId ?? null)
    if (!assigned.error) void commitGameState(assigned.state)
    return assigned.error
  }

  const toggleCrambleSomedayItem = (itemId: string) => {
    const previous = gameRef.current
    if (!previous) return
    const nextState = toggleSomedayItem(previous, itemId)
    if (nextState !== previous) void commitGameState(nextState)
  }

  const updateCrambleSomedayItem = (itemId: string, input: NewSomedayItemInput) => {
    const previous = gameRef.current
    if (!previous) return 'Cramble is unavailable right now.'
    const result = updateSomedayItem(previous, itemId, input)
    if (result.error) return result.error
    const assigned = assignSomedayCategory(result.state, itemId, input.categoryId === undefined ? getSomedayCategories(previous).assignments[itemId] ?? null : input.categoryId)
    if (!assigned.error) void commitGameState(assigned.state)
    return assigned.error
  }

  const updateSomedayCategory = (change: SomedayCategoryChange) => {
    const previous = gameRef.current
    if (!previous) return 'Cramble is unavailable right now.'
    const result = changeSomedayCategory(previous, change)
    if (!result.error) void commitGameState(result.state)
    return result.error
  }

  const deleteCrambleSomedayItem = (itemId: string) => {
    const previous = gameRef.current
    if (!previous) return
    const nextState = deleteSomedayItem(previous, itemId)
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
    void commitGameState({
      ...purged,
      totalFlowers: previous.totalFlowers,
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

  const backfillCramble = () => 'Observatory is disabled.'
  const undoBackfillCramble = () => 'Observatory is disabled.'

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

  const openRhythm = () => {
    const current = gameRef.current
    if (current && !current.rhythm) {
      void commitGameState({ ...current, rhythm: getRhythmSettings(current, getRhythmTrackers(current, crambleQuests)) })
    }
    setView('rhythm')
  }
  const createCategory = (name: string) => {
    const current = gameRef.current
    if (!current) return { id: null, error: 'Cramble is not ready yet.' }
    const seeded = { ...current, rhythm: getRhythmSettings(current, getRhythmTrackers(current, crambleQuests)) }
    const result = createRhythmCategory(seeded, name)
    if (!result.error) void commitGameState(result.state)
    return { id: result.id, error: result.error }
  }
  const assignCategory = (habitId: string, categoryId: string | null) => {
    const current = gameRef.current
    if (!current || !getRhythmTrackers(current, crambleQuests).some(item => item.id === habitId)) return 'This task is no longer available.'
    const result = assignRhythmCategory(current, habitId, categoryId)
    if (!result.error) void commitGameState(result.state)
    return result.error
  }

  if (!game) {
    return <div className="cramble-cosmic-shell"><CrambleBackground /><CrambleLoadingPage status={cloudSyncStatus} onBack={onBack} /></div>
  }

  if (!hasHanaStarted(game)) {
    return (
      <div className="cramble-cosmic-shell"><CrambleBackground /><CrambleStartPage
        onBack={onBack}
        onStart={() => void startToday()}
        isSaving={cloudSyncStatus === 'syncing'}
        isOffline={cloudSyncStatus === 'offline'}
        statusText={getStartStatus(cloudSyncStatus)}
      /></div>
    )
  }

  const withNavigation = (page: ReactNode) => <div className="cramble-app-shell cramble-cosmic-shell">
    <CrambleBackground />
    <CrambleSettingsContext.Provider value={() => setSettingsOpen(true)}><CrambleSharedSyncContext.Provider value={true}>{page}</CrambleSharedSyncContext.Provider></CrambleSettingsContext.Provider>
    <CloudSyncNotice profile="cramble" status={cloudSyncStatus} hasPendingSave={Boolean(pendingDbSaveRef.current)} saveConfirmedAt={saveConfirmedAt} onRetry={() => void refreshFromDb()} onExportBackup={() => downloadProfileJson(game, crambleQuests, 'cramble')} />
    {settingsOpen && <CrambleSettings habits={getRhythmSettings(game, getRhythmTrackers(game, crambleQuests))} someday={getSomedayCategories(game)} habitIds={game.openActivities.map(item => item.id)} somedayIds={(game.somedayItems ?? []).map(item => item.id)} onClose={() => setSettingsOpen(false)} onSomedayChange={updateSomedayCategory} onHabitChange={change => {
      const current = gameRef.current
      if (!current) return 'Cramble is not ready.'
      const result = changeRhythmCategory({ ...current, rhythm: getRhythmSettings(current, getRhythmTrackers(current, crambleQuests)) }, change)
      if (!result.error) void commitGameState(result.state)
      return result.error
    }} />}
    <CrambleNavigation view={view} onNavigate={destination => destination === 'rhythm' ? openRhythm() : setView(destination)} />
  </div>

  if (view === 'rhythm') {
    return withNavigation(<RhythmPage game={game} onCreateCategory={createCategory} onAssignCategory={assignCategory}
      sharedNavigation areaId={route.area ?? null} onOpenArea={area => setView('rhythm', area ? { area } : {})} onBackArea={back}
      taskId={route.taskId ?? null} onOpenTask={taskId => setView('rhythm', { area: route.area, taskId })}
      onToday={() => setView('tracker')} onObservatory={() => setView('observatory')}
      onSomeday={() => setView('someday')} onLedger={() => setView('ledger')}
      syncStatus={cloudSyncStatus} hasPendingSave={Boolean(pendingDbSaveRef.current)}
      saveConfirmedAt={saveConfirmedAt} onRetry={() => void refreshFromDb()} />)
  }

  if (view === 'lifetime' || view === 'observatory') {
    return withNavigation(
      <LifetimePage counters={game.lifetimeCounters ?? []} today={game.currentDate} onChange={change => {
        const current = gameRef.current
        if (!current) return 'Cramble is not ready yet.'
        const result = changeLifetime(current, change)
        if (!result.error) void commitGameState(result.state)
        return result.error
      }} />
    )
  }

  if (view === 'ledger') {
    return withNavigation(
      <CrambleLedgerPage
        game={game}
        onRestoreHabit={restoreCrambleHabit}
        onDeleteHabit={deleteCrambleHabit}
        onOpenQuest={(questId) => {
          setView('ledgerDetail', { questId })
        }}
        onOpenEmotion={() => setView('emotionHistory')}
      />
    )
  }

  if (view === 'someday') {
    return withNavigation(
      <CrambleSomedayPage
        items={game.somedayItems ?? []}
        settings={getSomedayCategories(game)}
        onCategoryChange={updateSomedayCategory}
        onAdd={addCrambleSomedayItem}
        onUpdate={updateCrambleSomedayItem}
        onDelete={deleteCrambleSomedayItem}
        onToggle={toggleCrambleSomedayItem}
      />
    )
  }

  if (view === 'emotionHistory') {
    return withNavigation(
      <EmotionHistoryPage
        game={game}
        profileId="cramble"
        onBack={back}
      />
    )
  }

  if (view === 'ledgerDetail' && selectedQuestId && game.openActivities.some(item => item.id === selectedQuestId)) {
    return withNavigation(
      <CrambleQuestDetailPage
        game={game}
        questId={selectedQuestId}
        onBack={back}
      />
    )
  }

  return withNavigation(
    <CramblePage
      game={game}
      onAddHabit={addCrambleHabit}
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
      onRecordRecentEmotion={recordCrambleRecentEmotion}
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
      onOpenObservatory={() => setView('observatory')}
      onOpenSomeday={() => setView('someday')}
      onOpenLedger={() => setView('ledger')}
      onOpenRhythm={openRhythm}
      onNextDay={goToNextDay}
      onReset={reset}
      onSyncCloud={() => void refreshFromDb()}
      cloudSyncStatus={cloudSyncStatus}
      lastCloudSyncAt={lastCloudSyncAt}
      hasPendingCloudSave={Boolean(pendingDbSaveRef.current)}
      saveConfirmedAt={saveConfirmedAt}
    />
  )
}

function CrambleLoadingPage({
  status,
  onBack,
}: {
  status: CrambleSyncStatus
  onBack?: () => void
}) {
  const headingRef = usePageHeadingFocus()

  return (
    <div
      className="cramble-archive-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6"
      aria-busy={status === 'loading' || status === 'syncing'}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="relative z-10 flex min-h-11 items-center justify-center gap-1 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink shadow-sm outline-none transition active:scale-95 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </button>
      )}
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
