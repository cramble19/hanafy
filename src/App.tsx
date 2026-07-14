import { useCallback, useEffect, useRef, useState } from 'react'
import { quests } from '@/data/quests'
import { createHanaCloudSyncPayload } from '@/lib/hanaCloudSync'
import {
  addDays,
  createInitialHanaState,
  getSkipEventKey,
  getSkipProgress,
  getSkipWeekKey,
  parseStoredHanaState,
  recomputeTotalFlowers,
  STORAGE_KEY,
  syncActiveQuestPlan,
  syncStateToDate,
  todayKey,
} from '@/lib/hanaGame'
import { HomePage } from '@/pages/HomePage'
import { HanaPage } from '@/pages/HanaPage'
import { GardenPage } from '@/pages/GardenPage'
import { StatsPage } from '@/pages/StatsPage'
import type { HanaGameState } from '@/types'

type View = 'home' | 'hana' | 'garden' | 'stats'
type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'disabled'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [hanaGame, setHanaGame] = useState<HanaGameState>(() => {
    if (typeof window === 'undefined') {
      return syncActiveQuestPlan(createInitialHanaState(), quests)
    }

    const saved = window.localStorage.getItem(STORAGE_KEY)
    return parseStoredHanaState(saved, quests)
  })
  const hanaGameRef = useRef(hanaGame)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(
    import.meta.env.DEV ? 'disabled' : 'idle',
  )
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null)

  useEffect(() => {
    hanaGameRef.current = hanaGame
  }, [hanaGame])

  const syncHanaToCloud = useCallback(async (silent = false) => {
    if (import.meta.env.DEV) {
      if (!silent) {
        setCloudSyncStatus('disabled')
      }
      return false
    }

    if (!navigator.onLine) {
      if (!silent) {
        setCloudSyncStatus('offline')
      }
      return false
    }

    if (!silent) {
      setCloudSyncStatus('syncing')
    }

    const payload = createHanaCloudSyncPayload(
      'hana',
      hanaGameRef.current,
      quests,
    )

    try {
      const response = await fetch('/api/hana-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.warn('Hana cloud sync failed', response.status)
        if (!silent) {
          setCloudSyncStatus('error')
        }
        return false
      }

      setLastCloudSyncAt(new Date().toISOString())
      setCloudSyncStatus('synced')
      return true
    } catch (error: unknown) {
      console.warn('Hana cloud sync failed', error)
      if (!silent) {
        setCloudSyncStatus('error')
      }
      return false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hanaGame))
  }, [hanaGame])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      void syncHanaToCloud(true)
    }, 800)
    return () => window.clearTimeout(timeoutId)
  }, [hanaGame, syncHanaToCloud])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return undefined
    }

    const syncToToday = () => {
      const currentDate = todayKey()
      setHanaGame((prev) =>
        prev.currentDate === currentDate
          ? prev
          : syncStateToDate(prev, quests, currentDate),
      )
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
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return undefined
    }

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncHanaToCloud(true)
      }
    }

    const syncSilently = () => {
      void syncHanaToCloud(true)
    }

    window.addEventListener('focus', syncSilently)
    window.addEventListener('online', syncSilently)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.removeEventListener('focus', syncSilently)
      window.removeEventListener('online', syncSilently)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [syncHanaToCloud])

  const toggleHana = (id: string) =>
    setHanaGame((prev) => {
      const quest = quests.find((item) => item.id === id)
      if (!quest) {
        return prev
      }

      const nextState =
        quest.group === 'longTerm'
          ? toggleLongTermQuest(prev, id)
          : toggleDailyQuest(prev, id)

      const withUpdatedFlowers = {
        ...nextState,
        totalFlowers: recomputeTotalFlowers(nextState, quests),
      }

      return withUpdatedFlowers
    })

  const toggleWeed = (id: string) =>
    setHanaGame((prev) => {
      const eveningWeeds = prev.eveningWeeds ?? {}
      const currentWeeds = eveningWeeds[prev.currentDate] ?? {}
      const nextState: HanaGameState = {
        ...prev,
        eveningWeeds: {
          ...eveningWeeds,
          [prev.currentDate]: {
            ...currentWeeds,
            [id]: !currentWeeds[id],
          },
        },
      }

      return {
        ...nextState,
        totalFlowers: recomputeTotalFlowers(nextState, quests),
      }
    })

  const toggleSkip = (id: string) =>
    setHanaGame((prev) => {
      const quest = quests.find((item) => item.id === id)
      if (!quest) {
        return prev
      }

      const weekKey = getSkipWeekKey(prev.currentDate)
      const skipKey = getSkipEventKey(prev, quest)
      const skipsThisWeek = prev.questSkips?.[weekKey] ?? {}
      const isSkipped = Boolean(skipsThisWeek[skipKey])
      const skipProgress = getSkipProgress(prev)

      if (!isSkipped && skipProgress.remaining <= 0) {
        return prev
      }

      return {
        ...prev,
        questSkips: {
          ...(prev.questSkips ?? {}),
          [weekKey]: {
            ...skipsThisWeek,
            [skipKey]: !isSkipped,
          },
        },
      }
    })

  const goToNextDay = () =>
    setHanaGame((prev) =>
      syncActiveQuestPlan(
        {
          ...prev,
          currentDate: addDays(prev.currentDate, 1),
        },
        quests,
      ),
    )

  const resetHana = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setHanaGame(
      syncActiveQuestPlan(
        {
          ...createInitialHanaState(),
          currentDate: todayKey(),
        },
        quests,
      ),
    )
  }

  if (view === 'hana') {
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
        onSyncCloud={() => void syncHanaToCloud(false)}
        cloudSyncStatus={cloudSyncStatus}
        lastCloudSyncAt={lastCloudSyncAt}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'garden') {
    return <GardenPage game={hanaGame} onBack={() => setView('hana')} />
  }

  if (view === 'stats') {
    return <StatsPage game={hanaGame} onBack={() => setView('hana')} />
  }

  return <HomePage onSelectHana={() => setView('hana')} />
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
