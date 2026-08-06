import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Compass } from 'lucide-react'
import { crambleQuests } from '@/data/crambleQuests'
import {
  createCustomHabitQuest,
  getNewHabitValidationError,
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
  resetProfileProgress,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
  toggleQuestCompletion,
  undoQuestCompletion,
} from '@/lib/hanaGame'
import {
  clearHanaStateFromDb,
  chooseDbFirstState,
  loadHanaStateFromDb,
  saveProfileStateToDb,
} from '@/lib/hanaRemoteState'
import {
  CramblePage,
  type CrambleSyncStatus,
} from '@/pages/CramblePage'
import { CrambleStartPage } from '@/pages/CrambleStartPage'
import { CrambleLedgerPage } from '@/pages/CrambleLedgerPage'
import { CrambleQuestDetailPage } from '@/pages/CrambleQuestDetailPage'
import { ObservatoryPage } from '@/pages/ObservatoryPage'
import type { HanaGameState } from '@/types'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'

type CrambleView = 'tracker' | 'observatory' | 'ledger' | 'ledgerDetail'

type Props = {
  onBack: () => void
}

export function CrambleExperience({ onBack }: Props) {
  const [view, setView] = useState<CrambleView>('tracker')
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [game, setGame] = useState<HanaGameState | null>(null)
  const gameRef = useRef<HanaGameState | null>(null)
  const clearedUnstartedDbRef = useRef(false)
  const pendingDbSaveRef = useRef<HanaGameState | null>(null)
  const isDbSaveInFlightRef = useRef(false)
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
            setCloudSyncStatus('error')
            return
          }

          clearPendingCacheIfSaved(stateToSave)
          setLastCloudSyncAt(result.syncedAt)
        }
        setCloudSyncStatus('synced')
      } finally {
        isDbSaveInFlightRef.current = false
      }
    }

    const savePromise = runSaveLoop().finally(() => {
      saveLoopPromiseRef.current = null
    })
    saveLoopPromiseRef.current = savePromise
    return savePromise
  }, [clearPendingCacheIfSaved])

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

      const databaseState = parseStoredHanaState(
        JSON.stringify(remote.snapshot.state),
        crambleQuests,
        todayKey(),
        CRAMBLE_QUEST_PLAN_OPTIONS,
      )
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
        setGame(initialState)
        clearCache()
        clearPendingCache()
        if (!clearedUnstartedDbRef.current) {
          clearedUnstartedDbRef.current = true
          setCloudSyncStatus('syncing')
          const clearResult = await clearHanaStateFromDb('cramble')
          if (!clearResult.ok) {
            setCloudSyncStatus('error')
            return false
          }
        }
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
    if (import.meta.env.DEV) return undefined

    const syncToToday = () => {
      const current = gameRef.current
      if (!current || !hasHanaStarted(current)) return
      const currentDate = todayKey()
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
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncToToday()
    }

    syncToToday()
    window.addEventListener('focus', syncToToday)
    document.addEventListener('visibilitychange', syncWhenVisible)
    const intervalId = window.setInterval(syncToToday, 60 * 1000)

    return () => {
      window.removeEventListener('focus', syncToToday)
      document.removeEventListener('visibilitychange', syncWhenVisible)
      window.clearInterval(intervalId)
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
    const startedState = syncStateToDate(
      createStartedHanaState(todayKey()),
      crambleQuests,
      todayKey(),
      CRAMBLE_QUEST_PLAN_OPTIONS,
    )
    clearCache()
    clearPendingCache()

    if (import.meta.env.DEV) {
      localMutationRevisionRef.current += 1
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
    const clearResult = await clearHanaStateFromDb('cramble')
    if (!clearResult.ok) {
      setCloudSyncStatus('error')
      return
    }

    const saveResult = await saveProfileStateToDb(
      startedState,
      'cramble',
      crambleQuests,
    )
    if (!saveResult.ok) {
      setCloudSyncStatus('error')
      return
    }

    localMutationRevisionRef.current += 1
    setGame(startedState)
    cacheGame(startedState)
    clearPendingCache()
    setLastCloudSyncAt(saveResult.syncedAt)
    setCloudSyncStatus('synced')
  }

  const toggleQuest = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === id)
    if (!quest) return

    const next = toggleQuestCompletion(previous, quest)
    void commitGameState({
      ...next,
      totalFlowers: recomputeTotalFlowers(next, catalog),
    })
  }

  const undoQuestOccurrence = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const catalog = getQuestCatalog(crambleQuests, previous)
    const quest = catalog.find((item) => item.id === id)
    if (!quest || quest.schedule?.kind !== 'periodTarget') return

    const next = undoQuestCompletion(previous, quest)
    if (next === previous) return
    void commitGameState({
      ...next,
      totalFlowers: recomputeTotalFlowers(next, catalog),
    })
  }

  const toggleSkip = (id: string) => {
    const previous = gameRef.current
    if (!previous) return
    const quest = getQuestCatalog(crambleQuests, previous).find(
      (item) => item.id === id,
    )
    if (
      !quest ||
      quest.schedule?.kind === 'quota' ||
      quest.schedule?.kind === 'periodTarget'
    ) return

    const weekKey = getSkipWeekKey(previous.currentDate)
    const skipKey = getSkipEventKey(previous, quest)
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
    void commitGameState({
      ...previous,
      customHabits: [...previous.customHabits, customHabit],
    })
    return null
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
