import type {
  Difficulty,
  Quest,
  QuestCompletionCriteria,
  QuestCompletionPath,
} from '@/types'

const MAX_COMPLETION_TARGET = 100

export function getDefaultQuestCompletionCriteria(
  difficulty: Difficulty,
  periodBased = false,
): QuestCompletionCriteria {
  if (periodBased) {
    if (difficulty === 'hard') {
      return anyOf({ kind: 'combo', target: 3 }, { kind: 'totalSuccesses', target: 5 })
    }
    return anyOf({ kind: 'combo', target: 2 }, { kind: 'totalSuccesses', target: 3 })
  }

  if (difficulty === 'hard') {
    return anyOf({ kind: 'combo', target: 7 }, { kind: 'totalSuccesses', target: 12 })
  }
  if (difficulty === 'medium') {
    return anyOf({ kind: 'combo', target: 5 }, { kind: 'totalSuccesses', target: 8 })
  }
  return anyOf({ kind: 'combo', target: 3 }, { kind: 'totalSuccesses', target: 5 })
}

export function getQuestCompletionCriteria(quest: Quest) {
  return quest.completionCriteria ?? getDefaultQuestCompletionCriteria(
    quest.difficulty,
    quest.group === 'longTerm' ||
      quest.schedule?.kind === 'periodTarget' ||
      quest.schedule?.kind === 'quota',
  )
}

export function getTotalOnlyCompletionCriteria(
  difficulty: Difficulty,
  periodBased = false,
) {
  const defaults = getDefaultQuestCompletionCriteria(difficulty, periodBased)
  const totalPath = defaults.paths.find(
    (path) => path.kind === 'totalSuccesses',
  )
  return { paths: [totalPath ?? { kind: 'totalSuccesses' as const, target: 5 }] }
}

export function normalizeQuestCompletionCriteria(
  value: unknown,
): QuestCompletionCriteria | null {
  if (!isRecord(value) || !Array.isArray(value.paths)) return null
  const paths = value.paths
    .map(normalizePath)
    .filter((path): path is QuestCompletionPath => Boolean(path))
    .slice(0, 2)
  if (!paths.length) return null
  if (new Set(paths.map((path) => path.kind)).size !== paths.length) return null
  return { paths }
}

export function describeQuestCompletionCriteria(
  criteria: QuestCompletionCriteria,
) {
  return criteria.paths.map(describePath).join(' or ')
}

function anyOf(
  first: QuestCompletionPath,
  second: QuestCompletionPath,
): QuestCompletionCriteria {
  return { paths: [first, second] }
}

function normalizePath(value: unknown): QuestCompletionPath | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'oneTime') return { kind: 'oneTime', target: 1 }
  if (
    (value.kind === 'combo' || value.kind === 'totalSuccesses') &&
    Number.isInteger(value.target) &&
    (value.target as number) >= 1 &&
    (value.target as number) <= MAX_COMPLETION_TARGET
  ) {
    return { kind: value.kind, target: value.target as number }
  }
  return null
}

function describePath(path: QuestCompletionPath) {
  if (path.kind === 'oneTime') return 'complete this quest once'
  if (path.kind === 'combo') {
    return `${path.target}-period combo`
  }
  return `${path.target} successful ${path.target === 1 ? 'period' : 'periods'} total`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
