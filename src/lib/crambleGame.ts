import { getLevel } from '@/lib/hanaGame'
import type { HanaGameState } from '@/types'

export const CRAMBLE_STORAGE_KEY = 'cramble-game/v1'
export const CRAMBLE_PENDING_STORAGE_KEY = 'cramble-game/pending-v1'
export const CRAMBLE_QUEST_PLAN_OPTIONS = {
  rotateExpiredLongTerm: true,
} as const

export const CRAMBLE_CHAPTER = {
  chapterNumber: 1,
  title: 'The First Oath',
  realm: 'The Sunward Archive',
  targetLevel: 5,
  targetRenown: 35,
  nextChapter: 'The Ember Road',
} as const

const CRAMBLE_JOURNEY_STAGES = [
  {
    minimumPercent: 0,
    landmark: 'The First Fire',
    note: 'The road is quiet. One useful action is enough to begin.',
  },
  {
    minimumPercent: 15,
    landmark: 'The First Bend',
    note: 'Small, steady choices are already making a road.',
  },
  {
    minimumPercent: 40,
    landmark: 'The Old Pines',
    note: 'The old pines fall behind; steady steps matter more than speed.',
  },
  {
    minimumPercent: 70,
    landmark: 'The Eastern Ridge',
    note: 'The ridge opens toward morning, and distance becomes perspective.',
  },
  {
    minimumPercent: 100,
    landmark: 'The Sunward Gate',
    note: 'The First Oath has opened a new horizon. The Ember Road waits ahead.',
  },
] as const

export const CRAMBLE_JOURNEY = {
  originLeftPercent: 24,
  startSeparationPercent: 12,
  endSeparationPercent: 60,
  startBottomPercent: 14,
  endBottomPercent: 52,
  startScale: 1,
  endScale: 0.62,
} as const


export function getCrambleChapterProgress(state: HanaGameState) {
  const level = getLevel(state.totalFlowers)
  const renownPercent = Math.min(
    100,
    Math.round((state.totalFlowers / CRAMBLE_CHAPTER.targetRenown) * 100),
  )
  const levelPercent = Math.min(
    100,
    Math.round((level / CRAMBLE_CHAPTER.targetLevel) * 100),
  )
  const percent = Math.min(renownPercent, levelPercent)

  return {
    ...CRAMBLE_CHAPTER,
    level,
    percent,
    renownPercent,
    levelPercent,
    renownRemaining: Math.max(
      0,
      CRAMBLE_CHAPTER.targetRenown - state.totalFlowers,
    ),
    levelsRemaining: Math.max(0, CRAMBLE_CHAPTER.targetLevel - level),
    isComplete:
      level >= CRAMBLE_CHAPTER.targetLevel &&
      state.totalFlowers >= CRAMBLE_CHAPTER.targetRenown,
  }
}

export function getCrambleJourneyProgress(state: HanaGameState) {
  const earnedRenown = Number.isFinite(state.totalFlowers)
    ? Math.max(0, state.totalFlowers)
    : 0
  const ratio = Math.min(1, earnedRenown / CRAMBLE_CHAPTER.targetRenown)
  const percent = Math.round(ratio * 100)
  const stage = [...CRAMBLE_JOURNEY_STAGES]
    .reverse()
    .find((candidate) => percent >= candidate.minimumPercent)
  const separationPercent = interpolate(
    CRAMBLE_JOURNEY.startSeparationPercent,
    CRAMBLE_JOURNEY.endSeparationPercent,
    ratio,
  )

  return {
    percent,
    ratio,
    landmark: stage?.landmark ?? CRAMBLE_JOURNEY_STAGES[0].landmark,
    note: stage?.note ?? CRAMBLE_JOURNEY_STAGES[0].note,
    separationPercent,
    knightLeftPercent:
      CRAMBLE_JOURNEY.originLeftPercent + separationPercent,
    knightBottomPercent: interpolate(
      CRAMBLE_JOURNEY.startBottomPercent,
      CRAMBLE_JOURNEY.endBottomPercent,
      ratio,
    ),
    knightScale: interpolate(
      CRAMBLE_JOURNEY.startScale,
      CRAMBLE_JOURNEY.endScale,
      ratio,
    ),
  }
}

function interpolate(start: number, end: number, progress: number) {
  return Math.round((start + (end - start) * progress) * 1000) / 1000
}
