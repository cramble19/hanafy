import { useEffect } from 'react'
import {
  getQuestCatalog,
  getQuestScheduleProgress,
  isQuestActivatedOnDate,
  todayKey,
} from '@/lib/hanaGame'
import {
  getHabitSettings,
  isHabitTrackableOnDate,
} from '@/lib/habitLifecycle'
import { isLogicalDayReminderDue } from '@/lib/logicalDay'
import type { HanaGameState, Quest } from '@/types'

export function useHabitReminders(
  profile: 'hana' | 'cramble',
  game: HanaGameState | null,
  baseQuests: Quest[],
) {
  useEffect(() => {
    if (
      !game ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return undefined
    }

    const check = () => {
      if (document.visibilityState !== 'visible') return
      const now = new Date()
      if (game.currentDate !== todayKey(now)) return
      const catalog = getQuestCatalog(baseQuests, game)

      catalog.forEach((quest) => {
        const settings = getHabitSettings(game, quest.id)
        const progress = getQuestScheduleProgress(game, quest)
        if (
          quest.catalogState === 'legacy' ||
          !isQuestActivatedOnDate(game, quest.id) ||
          !settings.reminder.enabled ||
          !settings.reminder.time ||
          !isLogicalDayReminderDue(
            now,
            game.currentDate,
            settings.reminder.time,
          ) ||
          !isHabitTrackableOnDate(game, quest.id) ||
          !progress.isScheduledToday ||
          progress.isComplete
        ) {
          return
        }

        const deliveryKey = `hanafy-reminder/${profile}/${game.currentDate}/${quest.id}`
        if (window.localStorage.getItem(deliveryKey)) return
        window.localStorage.setItem(deliveryKey, 'sending')
        void showHabitNotification(
          quest.title,
          settings.cue ||
            (profile === 'hana'
              ? 'One small garden step is waiting.'
              : 'One small step waits in the Sunward Archive.'),
          deliveryKey,
        ).then(
          () => window.localStorage.setItem(deliveryKey, new Date().toISOString()),
          () => window.localStorage.removeItem(deliveryKey),
        )
      })
    }

    check()
    const intervalId = window.setInterval(check, 30_000)
    return () => window.clearInterval(intervalId)
  }, [baseQuests, game, profile])
}

async function showHabitNotification(title: string, body: string, tag: string) {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, tag })
      return
    }
  }
  new Notification(title, { body, tag })
}
