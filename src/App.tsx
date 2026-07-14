import { useCallback, useEffect, useRef, useState } from 'react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { quests } from '@/data/quests'
import {
  addDays,
  createInitialHanaState,
  createStartedHanaState,
  getSkipEventKey,
  getSkipProgress,
  getSkipWeekKey,
  hasHanaStarted,
  parseStoredHanaState,
  recomputeTotalFlowers,
  STORAGE_KEY,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
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
import { QuestStatsPage } from '@/pages/QuestStatsPage'
import { QuestDetailPage } from '@/pages/QuestDetailPage'
import { WeedStatsPage } from '@/pages/WeedStatsPage'
import { WeedDetailPage } from '@/pages/WeedDetailPage'
import type { HanaGameState } from '@/types'

type View =
  | 'home'
  | 'hanaStart'
  | 'hana'
  | 'garden'
  | 'stats'
  | 'questStats'
  | 'questDetail'
  | 'weedStats'
  | 'weedDetail'
type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline'
  | 'disabled'
  | 'preview'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [selectedWeedId, setSelectedWeedId] = useState<string | null>(null)
  const [isExploringHana, setIsExploringHana] = useState(false)
  const [hanaGame, setHanaGame] = useState<HanaGameState | null>(null)
  const hanaGameRef = useRef<HanaGameState | null>(null)
  const clearedUnstartedDbRef = useRef(false)
  const pendingDbSaveRef = useRef<HanaGameState | null>(null)
  const isDbSaveInFlightRef = useRef(false)
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

  const readCachedHanaGame = useCallback(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
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

  const hydrateFromDb = useCallback(
    async (silent = false) => {
      if (silent && (pendingDbSaveRef.current || isDbSaveInFlightRef.current)) {
        return false
      }

      if (import.meta.env.DEV) {
        const cachedState = readCachedHanaGame()
        const initialState = createInitialSyncedState()
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState,
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
        const cachedState = readCachedHanaGame()
        const initialState = createInitialSyncedState()
        const chosen = chooseDbFirstState({
          databaseState: null,
          cachedState,
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
      if (!remote.ok) {
        const fallbackState =
          hanaGameRef.current ?? readCachedHanaGame() ?? createInitialSyncedState()
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

      const databaseState = remote.snapshot
        ? parseStoredHanaState(JSON.stringify(remote.snapshot.state), quests)
        : null
      const cachedState = readCachedHanaGame()
      const initialState = createInitialSyncedState()
      const chosen = chooseDbFirstState({
        databaseState,
        cachedState,
        initialState,
      })
      const stateForToday = syncStateToDate(chosen.state, quests)

      if (!hasHanaStarted(stateForToday)) {
        setHanaGame(initialState)
        clearHanaCache()
        if (remote.snapshot && !clearedUnstartedDbRef.current) {
          clearedUnstartedDbRef.current = true
          await clearHanaStateFromDb('hana')
        }
        setCloudSyncStatus('preview')
        return true
      }

      setHanaGame(stateForToday)
      cacheHanaGame(stateForToday)

      const shouldSeedOrRefreshDb =
        chosen.source !== 'database' ||
        remote.snapshot?.currentDate !== stateForToday.currentDate
      if (shouldSeedOrRefreshDb) {
        const saveResult = await saveHanaStateToDb(stateForToday, 'hana')
        if (saveResult.ok) {
          setLastCloudSyncAt(saveResult.syncedAt)
          setCloudSyncStatus('synced')
          return true
        }

        setCloudSyncStatus('error')
        return false
      }

      setLastCloudSyncAt(remote.snapshot?.syncedAt ?? null)
      setCloudSyncStatus('synced')
      return true
    },
    [cacheHanaGame, clearHanaCache, createInitialSyncedState, readCachedHanaGame],
  )

  const flushQueuedDbSave = useCallback(async () => {
    if (import.meta.env.DEV || isDbSaveInFlightRef.current) {
      return
    }

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

        setLastCloudSyncAt(saveResult.syncedAt)
      }

      setCloudSyncStatus('synced')
    } finally {
      isDbSaveInFlightRef.current = false
    }
  }, [])

  const commitHanaState = useCallback(
    async (nextState: HanaGameState, silent = false) => {
      const stateForToday = syncStateToDate(nextState, quests, nextState.currentDate)

      if (!hasHanaStarted(stateForToday)) {
        setHanaGame(stateForToday)
        setCloudSyncStatus('preview')
        return false
      }

      setHanaGame(stateForToday)
      cacheHanaGame(stateForToday)

      if (import.meta.env.DEV) {
        setCloudSyncStatus('disabled')
        return true
      }

      if (!navigator.onLine) {
        setCloudSyncStatus('offline')
        return false
      }

      if (!silent) {
        setCloudSyncStatus('syncing')
      }

      pendingDbSaveRef.current = stateForToday
      void flushQueuedDbSave()
      return true
    },
    [cacheHanaGame, flushQueuedDbSave],
  )

  const refreshHanaFromDb = useCallback(async () => {
    if (pendingDbSaveRef.current || isDbSaveInFlightRef.current) {
      setCloudSyncStatus('syncing')
      await flushQueuedDbSave()
      return !pendingDbSaveRef.current
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

    const refreshSilently = () => {
      void hydrateFromDb(true)
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently()
      }
    }

    window.addEventListener('focus', refreshSilently)
    window.addEventListener('online', refreshSilently)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.removeEventListener('focus', refreshSilently)
      window.removeEventListener('online', refreshSilently)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [hydrateFromDb])

  const toggleHana = (id: string) => {
    const previousState = hanaGameRef.current
    if (!previousState) {
      return
    }

    const quest = quests.find((item) => item.id === id)
    if (!quest) {
      return
    }

    const nextState =
      quest.group === 'longTerm'
        ? toggleLongTermQuest(previousState, id)
        : toggleDailyQuest(previousState, id)
    const withUpdatedFlowers = {
      ...nextState,
      totalFlowers: recomputeTotalFlowers(nextState, quests),
    }

    void commitHanaState(withUpdatedFlowers)
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

    const quest = quests.find((item) => item.id === id)
    if (!quest) {
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
    const resetDate = previousState?.startDate ?? todayKey()
    void commitHanaState(
      syncActiveQuestPlan(
        {
          ...createStartedHanaState(resetDate),
        },
        quests,
      ),
    )
  }

  const startHanaToday = async () => {
    const startedState = syncStateToDate(createStartedHanaState(todayKey()), quests)

    setIsExploringHana(false)
    clearHanaCache()

    if (import.meta.env.DEV) {
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

    setHanaGame(startedState)
    cacheHanaGame(startedState)
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
          onSkip={toggleSkip}
          onToggleWeed={toggleWeed}
          onOpenGarden={() => setView('garden')}
          onOpenStats={() => setView('stats')}
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
        onSkip={toggleSkip}
        onToggleWeed={toggleWeed}
        onOpenGarden={() => setView('garden')}
        onOpenStats={() => setView('stats')}
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
        onOpenQuests={() => setView('questStats')}
        onOpenWeeds={() => setView('weedStats')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'questStats') {
    return hanaGame ? (
      <QuestStatsPage
        game={hanaGame}
        onBack={() => setView('stats')}
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
        onBack={() => setView('questStats')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'weedStats') {
    return hanaGame ? (
      <WeedStatsPage
        game={hanaGame}
        onBack={() => setView('stats')}
        onOpenWeed={(weedId) => {
          setSelectedWeedId(weedId)
          setView('weedDetail')
        }}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  if (view === 'weedDetail') {
    return hanaGame && selectedWeedId ? (
      <WeedDetailPage
        game={hanaGame}
        weedId={selectedWeedId}
        onBack={() => setView('weedStats')}
      />
    ) : (
      <HanaLoadingPage status={cloudSyncStatus} onBack={() => setView('home')} />
    )
  }

  return <HomePage onSelectHana={openHana} />
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

function toggleDailyQuest(state: HanaGameState, questId: string): HanaGameState {
  const currentCompletions = state.dailyCompletions[state.currentDate] ?? {}
  const wasComplete = Boolean(currentCompletions[questId])

  return {
    ...state,
    dailyCompletions: {
      ...state.dailyCompletions,
      [state.currentDate]: {
        ...currentCompletions,
        [questId]: !wasComplete,
      },
    },
  }
}

function toggleLongTermQuest(state: HanaGameState, questId: string): HanaGameState {
  const startedAt = state.longTermWindows[questId] ?? state.currentDate
  const questCompletions = state.longTermCompletions[questId] ?? {}
  const wasComplete = Boolean(questCompletions[startedAt])

  return {
    ...state,
    longTermWindows: {
      ...state.longTermWindows,
      [questId]: startedAt,
    },
    longTermCompletions: {
      ...state.longTermCompletions,
      [questId]: {
        ...questCompletions,
        [startedAt]: !wasComplete,
      },
    },
  }
}
