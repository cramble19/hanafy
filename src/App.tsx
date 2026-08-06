import { useCallback, useEffect, useRef, useState } from 'react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { quests } from '@/data/quests'
import {
  createCustomHabitQuest,
  getNewHabitValidationError,
  type NewHabitInput,
} from '@/lib/customHabits'
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
  STORAGE_KEY,
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
  saveHanaStateToDb,
} from '@/lib/hanaRemoteState'
import { HomePage } from '@/pages/HomePage'
import { HanaStartPage } from '@/pages/HanaStartPage'
import { HanaPage } from '@/pages/HanaPage'
import { GardenPage } from '@/pages/GardenPage'
import { StatsPage } from '@/pages/StatsPage'
import { QuestDetailPage } from '@/pages/QuestDetailPage'
import { CrambleGatePage } from '@/pages/CrambleGatePage'
import { CrambleExperience } from '@/features/cramble/CrambleExperience'
import type { HanaGameState } from '@/types'

type View =
  | 'home'
  | 'hanaStart'
  | 'hana'
  | 'garden'
  | 'stats'
  | 'questDetail'
  | 'crambleGate'
  | 'cramble'
type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline'
  | 'disabled'
  | 'preview'
type HomeFocusTarget = 'hana' | 'cramble' | null

const HANA_PENDING_STORAGE_KEY = 'hana-game/pending-v1'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [homeFocusTarget, setHomeFocusTarget] =
    useState<HomeFocusTarget>(null)
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [isExploringHana, setIsExploringHana] = useState(false)
  const [hanaGame, setHanaGame] = useState<HanaGameState | null>(null)
  const hanaGameRef = useRef<HanaGameState | null>(null)
  const clearedUnstartedDbRef = useRef(false)
  const pendingDbSaveRef = useRef<HanaGameState | null>(null)
  const isDbSaveInFlightRef = useRef(false)
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
            setCloudSyncStatus('error')
            return
          }

          clearPendingHanaCacheIfSaved(stateToSave)
          setLastCloudSyncAt(saveResult.syncedAt)
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
  }, [clearPendingHanaCacheIfSaved])

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

      const databaseState = parseStoredHanaState(
        JSON.stringify(remote.snapshot.state),
        quests,
      )
      const chosen = chooseDbFirstState({
        databaseState,
        cachedState: readCachedHanaGame(),
        initialState,
      })
      const stateForToday = syncStateToDate(chosen.state, quests)

      if (!hasHanaStarted(stateForToday)) {
        setHanaGame(initialState)
        clearHanaCache()
        clearPendingHanaCache()
        if (!clearedUnstartedDbRef.current) {
          clearedUnstartedDbRef.current = true
          setCloudSyncStatus('syncing')
          const clearResult = await clearHanaStateFromDb('hana')
          if (!clearResult.ok) {
            setCloudSyncStatus('error')
            return false
          }
        }
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
    if (pendingDbSaveRef.current || isDbSaveInFlightRef.current) {
      setCloudSyncStatus('syncing')
      await flushQueuedDbSave()
      if (pendingDbSaveRef.current) {
        return false
      }
    }

    return hydrateFromDb(false)
  }, [flushQueuedDbSave, hydrateFromDb])

  useEffect(() => {
    void hydrateFromDb()
  }, [hydrateFromDb])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return undefined
    }

    const syncToToday = () => {
      const previousState = hanaGameRef.current
      if (!previousState || !hasHanaStarted(previousState)) {
        return
      }

      const currentDate = todayKey()
      if (previousState.currentDate !== currentDate) {
        void commitHanaState(syncStateToDate(previousState, quests, currentDate), true)
      }
    }

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        syncToToday()
      }
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
  }, [commitHanaState])

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

    void commitHanaState(withUpdatedFlowers)
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

    void commitHanaState({
      ...nextState,
      totalFlowers: recomputeTotalFlowers(nextState, catalog),
    })
  }

  const toggleWeed = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

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
    if (
      !quest ||
      quest.schedule?.kind === 'quota' ||
      quest.schedule?.kind === 'periodTarget'
    ) {
      return
    }

    const weekKey = getSkipWeekKey(previousState.currentDate)
    const skipKey = getSkipEventKey(previousState, quest)
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
    void commitHanaState({
      ...previousState,
      customHabits: [...previousState.customHabits, customHabit],
    })
    return null
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
    const startedState = syncStateToDate(createStartedHanaState(todayKey()), quests)

    setIsExploringHana(false)
    clearHanaCache()
    clearPendingHanaCache()
    pendingDbSaveRef.current = null

    if (import.meta.env.DEV) {
      localMutationRevisionRef.current += 1
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
    const clearResult = await clearHanaStateFromDb('hana')
    if (!clearResult.ok) {
      setCloudSyncStatus('error')
      return
    }

    const saveResult = await saveHanaStateToDb(startedState, 'hana')
    if (!saveResult.ok) {
      setCloudSyncStatus('error')
      return
    }

    localMutationRevisionRef.current += 1
    setHanaGame(startedState)
    cacheHanaGame(startedState)
    clearPendingHanaCache()
    setLastCloudSyncAt(saveResult.syncedAt)
    setCloudSyncStatus('synced')
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
          onSkip={toggleSkip}
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
        onSkip={toggleSkip}
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
        onOpenQuest={(questId) => {
          setSelectedQuestId(questId)
          setView('questDetail')
        }}
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

  if (view === 'crambleGate') {
    return (
      <CrambleGatePage
        onBack={() => setView('home')}
        onUnlock={() => setView('cramble')}
      />
    )
  }

  if (view === 'cramble') {
    return <CrambleExperience onBack={() => setView('home')} />
  }

  return (
    <HomePage
      focusTarget={homeFocusTarget}
      onSelectHana={() => {
        setHomeFocusTarget('hana')
        openHana()
      }}
      onSelectCramble={() => {
        setHomeFocusTarget('cramble')
        setView('crambleGate')
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
