import type {
  GameState,
  Quest,
  QuestCompletionCriteria,
  QuestCompletionPath,
} from '@/types'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { addDays } from '@/lib/hanaGame'
import { getHabitSettings } from '@/lib/habitLifecycle'
import { getHabitRangeStats, type HabitPeriodStat } from '@/lib/hanaStats'
import { getQuestCompletionCriteria } from '@/lib/questCompletionRules'

export type QuestCompletionPathProgress = QuestCompletionPath & {
  current: number
  isMet: boolean
  achievedDate: string | null
}

export type QuestCompletionProgress = {
  criteria: QuestCompletionCriteria
  paths: QuestCompletionPathProgress[]
  isMet: boolean
  achievedDate: string | null
}

export function getQuestCompletionProgress(
  state: GameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
  quest: Quest,
): QuestCompletionProgress {
  const criteria = getQuestCompletionCriteria(quest)
  const stats = getHabitRangeStats(
    state,
    baseQuests,
    profileId,
    quest.id,
    'all',
  )
  const cycleStartedOn = getHabitSettings(
    state,
    quest.id,
  ).completion.cycleStartedOn
  const periods = (stats?.periods ?? []).filter(
    (period) => !cycleStartedOn || period.startDate >= cycleStartedOn,
  )
  const paths = criteria.paths.map((path) => getPathProgress(path, periods))
  const metPaths = paths.filter((path) => path.isMet && path.achievedDate)
  const achievedDate = metPaths.length
    ? metPaths
        .map((path) => path.achievedDate as string)
        .sort()[0]
    : null
  return {
    criteria,
    paths,
    isMet: metPaths.length > 0,
    achievedDate:
      achievedDate && achievedDate > state.currentDate
        ? state.currentDate
        : achievedDate,
  }
}

export function reconcileQuestGraduation(
  state: GameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
  quest: Quest,
) {
  if (quest.catalogState === 'legacy') return state
  const settings = getHabitSettings(state, quest.id)
  const existing = settings.completion.graduation
  const progress = getQuestCompletionProgress(
    state,
    baseQuests,
    profileId,
    quest,
  )

  if (existing && existing.effectiveDate <= state.currentDate) return state
  if (existing && !progress.isMet) {
    return setCompletion(state, quest.id, {
      ...settings.completion,
      graduation: null,
    })
  }
  if (existing || !progress.isMet || !progress.achievedDate) return state

  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return setCompletion(state, quest.id, {
    ...settings.completion,
    graduation: {
      id: `graduation-${randomId}`,
      achievedDate: progress.achievedDate,
      effectiveDate: addDays(state.currentDate, 1),
      recordedAt: new Date().toISOString(),
      criterionSnapshot: progress.criteria,
    },
  })
}

function getPathProgress(
  path: QuestCompletionPath,
  periods: HabitPeriodStat[],
): QuestCompletionPathProgress {
  if (path.kind === 'oneTime') {
    const completed = periods.filter((period) => period.status === 'completed')
    return {
      ...path,
      current: completed.length,
      isMet: completed.length >= 1,
      achievedDate: completed[0]?.endDate ?? null,
    }
  }

  if (path.kind === 'totalSuccesses') {
    const target = path.target
    const completed = periods.filter((period) => period.status === 'completed')
    return {
      ...path,
      current: completed.length,
      isMet: completed.length >= target,
      achievedDate: completed[target - 1]?.endDate ?? null,
    }
  }

  let current = 0
  let best = 0
  let achievedDate: string | null = null
  periods.forEach((period, index) => {
    if (period.status === 'completed') {
      current += 1
      best = Math.max(best, current)
      if (!achievedDate && current >= path.target) {
        achievedDate = period.endDate
      }
      return
    }
    if (period.status === 'missed') {
      current = 0
      return
    }
    if (
      period.status === 'open' &&
      periods.slice(index + 1).some((later) => later.status === 'completed')
    ) {
      current = 0
    }
  })
  return {
    ...path,
    current: achievedDate ? Math.max(path.target, best) : current,
    isMet: Boolean(achievedDate),
    achievedDate,
  }
}

function setCompletion(
  state: GameState,
  habitId: string,
  completion: ReturnType<typeof getHabitSettings>['completion'],
): GameState {
  const settings = getHabitSettings(state, habitId)
  return {
    ...state,
    habitSettings: {
      ...(state.habitSettings ?? {}),
      [habitId]: { ...settings, completion },
    },
  }
}
