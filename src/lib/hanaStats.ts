import { createHanaCloudSyncPayload } from '@/lib/hanaCloudSync'
import type { HanaGameState, Quest } from '@/types'

export type QuestStat = {
  questId: string
  title: string
  color: string
  emoji: string
  shown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
}

export type DailyStat = {
  dateKey: string
  shown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
}

export type HanaStats = {
  totalShown: number
  completed: number
  skipped: number
  missed: number
  open: number
  completionRate: number
  skipRate: number
  currentWeek: {
    shown: number
    completed: number
    skipped: number
    missed: number
    open: number
    completionRate: number
    days: DailyStat[]
  }
  questStats: QuestStat[]
  mostBlooming: QuestStat[]
  needsLove: QuestStat[]
  weedStats: Array<{
    weedId: string
    checked: number
  }>
}

export function getHanaStats(state: HanaGameState, quests: Quest[]): HanaStats {
  const payload = createHanaCloudSyncPayload('hana', state, quests)
  const questById = new Map(quests.map((quest) => [quest.id, quest]))
  const questStats = new Map<string, QuestStat>()
  const dailyStats = new Map<string, DailyStat>()
  const currentWeekStart = getWeekStartKey(state.currentDate)

  payload.questStatuses.forEach((row) => {
    const status = resolveStatus(row, state.currentDate)
    const quest = questById.get(row.questId)
    const stat = questStats.get(row.questId) ?? {
      questId: row.questId,
      title: quest?.title ?? row.questId,
      color: quest?.color ?? '#d98ba0',
      emoji: quest?.emoji ?? '🌸',
      shown: 0,
      completed: 0,
      skipped: 0,
      missed: 0,
      open: 0,
      completionRate: 0,
    }

    stat.shown += 1
    stat[status] += 1
    stat.completionRate = percent(stat.completed, stat.shown)
    questStats.set(row.questId, stat)

    const dateKey = row.dateKey ?? row.windowStart
    if (!dateKey || dateKey < currentWeekStart || dateKey > state.currentDate) {
      return
    }

    const dailyStat = dailyStats.get(dateKey) ?? {
      dateKey,
      shown: 0,
      completed: 0,
      skipped: 0,
      missed: 0,
      open: 0,
      completionRate: 0,
    }
    dailyStat.shown += 1
    dailyStat[status] += 1
    dailyStat.completionRate = percent(dailyStat.completed, dailyStat.shown)
    dailyStats.set(dateKey, dailyStat)
  })

  const totals = sumStats(Array.from(questStats.values()))
  const currentWeekDays = fillWeekDays(currentWeekStart, state.currentDate, dailyStats)
  const currentWeekTotals = sumStats(currentWeekDays)
  const sortedQuestStats = Array.from(questStats.values()).sort((first, second) =>
    first.title.localeCompare(second.title),
  )
  const mostBlooming = sortedQuestStats
    .filter((stat) => stat.completed > 0)
    .sort(
      (first, second) =>
        second.completed - first.completed ||
        second.completionRate - first.completionRate ||
        first.title.localeCompare(second.title),
    )
    .slice(0, 3)
  const needsLove = sortedQuestStats
    .filter((stat) => stat.skipped + stat.missed > 0)
    .sort(
      (first, second) =>
        second.skipped + second.missed - (first.skipped + first.missed) ||
        first.completionRate - second.completionRate ||
        first.title.localeCompare(second.title),
    )
    .slice(0, 3)

  return {
    ...totals,
    currentWeek: {
      ...currentWeekTotals,
      days: currentWeekDays,
    },
    questStats: sortedQuestStats,
    mostBlooming,
    needsLove,
    weedStats: getWeedStats(state),
  }
}

function resolveStatus(
  row: ReturnType<typeof createHanaCloudSyncPayload>['questStatuses'][number],
  currentDate: string,
): 'completed' | 'skipped' | 'missed' | 'open' {
  if (row.status === 'completed' || row.status === 'skipped') {
    return row.status
  }

  if (row.questGroup === 'daily') {
    return row.dateKey && row.dateKey < currentDate ? 'missed' : 'open'
  }

  return row.dueDate && row.dueDate < currentDate ? 'missed' : 'open'
}

function sumStats(
  stats: Array<Pick<QuestStat, 'shown' | 'completed' | 'skipped' | 'missed' | 'open'>>,
) {
  const totals = stats.reduce(
    (result, stat) => ({
      shown: result.shown + stat.shown,
      completed: result.completed + stat.completed,
      skipped: result.skipped + stat.skipped,
      missed: result.missed + stat.missed,
      open: result.open + stat.open,
    }),
    { shown: 0, completed: 0, skipped: 0, missed: 0, open: 0 },
  )

  return {
    shown: totals.shown,
    totalShown: totals.shown,
    completed: totals.completed,
    skipped: totals.skipped,
    missed: totals.missed,
    open: totals.open,
    completionRate: percent(totals.completed, totals.shown),
    skipRate: percent(totals.skipped, totals.shown),
  }
}

function getWeedStats(state: HanaGameState) {
  const weedCounts = new Map<string, number>()
  Object.values(state.eveningWeeds ?? {}).forEach((weeds) => {
    Object.entries(weeds).forEach(([weedId, checked]) => {
      if (checked) {
        weedCounts.set(weedId, (weedCounts.get(weedId) ?? 0) + 1)
      }
    })
  })

  return Array.from(weedCounts.entries())
    .map(([weedId, checked]) => ({ weedId, checked }))
    .sort((first, second) => second.checked - first.checked)
}

function fillWeekDays(
  startDateKey: string,
  currentDateKey: string,
  dailyStats: Map<string, DailyStat>,
) {
  const days: DailyStat[] = []
  let dateKey = startDateKey

  while (dateKey <= currentDateKey && days.length < 7) {
    days.push(
      dailyStats.get(dateKey) ?? {
        dateKey,
        shown: 0,
        completed: 0,
        skipped: 0,
        missed: 0,
        open: 0,
        completionRate: 0,
      },
    )
    dateKey = addDays(dateKey, 1)
  }

  return days
}

function getWeekStartKey(dateKey: string) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() - date.getDay())
  return formatDateKey(date)
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}
