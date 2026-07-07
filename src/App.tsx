import { useEffect, useState } from 'react'
import { quests } from '@/data/quests'
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
  todayKey,
} from '@/lib/hanaGame'
import { HomePage } from '@/pages/HomePage'
import { HanaPage } from '@/pages/HanaPage'
import { GardenPage } from '@/pages/GardenPage'
import type { HanaGameState } from '@/types'

type View = 'home' | 'hana' | 'garden'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [hanaGame, setHanaGame] = useState<HanaGameState>(() => {
    if (typeof window === 'undefined') {
      return syncActiveQuestPlan(createInitialHanaState(), quests)
    }

    const saved = window.localStorage.getItem(STORAGE_KEY)
    return parseStoredHanaState(saved, quests)
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hanaGame))
  }, [hanaGame])

  useEffect(() => {
    setHanaGame((prev) => syncActiveQuestPlan(prev, quests))
  }, [])

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
        onNextDay={goToNextDay}
        onReset={resetHana}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'garden') {
    return <GardenPage game={hanaGame} onBack={() => setView('hana')} />
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
