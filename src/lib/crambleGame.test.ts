import { describe, expect, it } from 'vitest'
import { crambleQuests } from '@/data/crambleQuests'
import crambleChronicles from '@/data/crambleChronicles.json'
import { quests as hanaQuests } from '@/data/quests'
import { createProfileCloudSyncPayload } from '@/lib/hanaCloudSync'
import {
  createStartedHanaState,
  hasValidQuestSchedule,
  syncStateToDate,
  visibleQuestsForState,
} from '@/lib/hanaGame'
import {
  CRAMBLE_JOURNEY,
  CRAMBLE_STORAGE_KEY,
  CRAMBLE_PENDING_STORAGE_KEY,
  getCrambleChapterProgress,
  getCrambleJourneyProgress,
} from '@/lib/crambleGame'
import { STORAGE_KEY } from '@/lib/hanaGame'

function stateWithRenown(totalFlowers: number) {
  return {
    ...createStartedHanaState('2026-08-06'),
    totalFlowers,
  }
}

describe('Cramble game', () => {
  it('keeps Cramble cache and quest IDs separate from Hana', () => {
    const state = syncStateToDate(
      createStartedHanaState('2026-08-06'),
      crambleQuests,
      '2026-08-06',
    )
    const visible = visibleQuestsForState(crambleQuests, state)
    const hanaIds = new Set(hanaQuests.map((quest) => quest.id))

    expect(CRAMBLE_STORAGE_KEY).not.toBe(STORAGE_KEY)
    expect(CRAMBLE_PENDING_STORAGE_KEY).not.toBe(CRAMBLE_STORAGE_KEY)
    expect(CRAMBLE_PENDING_STORAGE_KEY).not.toBe(STORAGE_KEY)
    expect(visible.daily.map((quest) => quest.id)).toEqual([
      'first-draught',
      'training-yard',
      'provisioners-plate',
      'evening-seal',
    ])
    expect(visible.longTerm).toEqual([])
    expect(visible.daily.every((quest) => !hanaIds.has(quest.id))).toBe(true)
    expect(crambleQuests.every((quest) => !hanaIds.has(quest.id))).toBe(true)
  })

  it('adds the Sunward Tablet on Sunday only', () => {
    const sunday = syncStateToDate(
      createStartedHanaState('2026-08-09'),
      crambleQuests,
      '2026-08-09',
    )
    const monday = syncStateToDate(
      sunday,
      crambleQuests,
      '2026-08-10',
    )

    expect(sunday.activeDailyQuests['2026-08-09']).toContain(
      'sunward-tablet',
    )
    expect(monday.activeDailyQuests['2026-08-10']).not.toContain(
      'sunward-tablet',
    )
  })

  it('serializes only Cramble profile rows with the Cramble catalog', () => {
    const state = syncStateToDate(
      createStartedHanaState('2026-08-06'),
      crambleQuests,
      '2026-08-06',
    )
    state.dailyCompletions['2026-08-06'] = { 'first-draught': true }
    state.totalFlowers = 1

    const payload = createProfileCloudSyncPayload(
      'cramble',
      state,
      crambleQuests,
      '2026-08-06T10:00:00.000Z',
    )

    expect(payload.profileId).toBe('cramble')
    expect(payload.questStatuses.length).toBeGreaterThan(0)
    expect(payload.questStatuses.every((row) => row.profileId === 'cramble')).toBe(
      true,
    )
    expect(payload.questStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questId: 'first-draught',
          status: 'completed',
          flowersEarned: 1,
        }),
      ]),
    )
  })

  it('completes The First Oath at rank 5 and 35 renown', () => {
    const state = {
      ...createStartedHanaState('2026-08-06'),
      totalFlowers: 35,
    }

    expect(getCrambleChapterProgress(state)).toEqual(
      expect.objectContaining({
        level: 5,
        percent: 100,
        renownRemaining: 0,
        isComplete: true,
      }),
    )
  })

  it.each([
    { renown: 0, percent: 0, separationPercent: 12 },
    { renown: 1, percent: 3, separationPercent: 13.371 },
    { renown: 5, percent: 14, separationPercent: 18.857 },
    { renown: 12, percent: 34, separationPercent: 28.457 },
    { renown: 22, percent: 63, separationPercent: 42.171 },
    { renown: 28, percent: 80, separationPercent: 50.4 },
    { renown: 34, percent: 97, separationPercent: 58.629 },
    { renown: 35, percent: 100, separationPercent: 60 },
  ])(
    'maps $renown renown to $percent% of the scenic journey',
    ({ renown, percent, separationPercent }) => {
      const journey = getCrambleJourneyProgress(stateWithRenown(renown))

      expect(journey.percent).toBe(percent)
      expect(journey.ratio).toBeCloseTo(renown / 35)
      expect(journey.separationPercent).toBe(separationPercent)
      expect(journey.knightLeftPercent).toBe(
        CRAMBLE_JOURNEY.originLeftPercent + separationPercent,
      )
    },
  )

  it('moves the knight strictly farther for every renown point through the First Oath', () => {
    let previousSeparation = getCrambleJourneyProgress(
      stateWithRenown(0),
    ).separationPercent

    for (let renown = 1; renown <= 35; renown += 1) {
      const separation = getCrambleJourneyProgress(
        stateWithRenown(renown),
      ).separationPercent

      expect(separation).toBeGreaterThan(previousSeparation)
      expect(separation).toBeGreaterThanOrEqual(
        CRAMBLE_JOURNEY.startSeparationPercent,
      )
      expect(separation).toBeLessThanOrEqual(
        CRAMBLE_JOURNEY.endSeparationPercent,
      )
      previousSeparation = separation
    }
  })

  it('clamps scenic movement below zero and above the chapter target', () => {
    const beforeStart = getCrambleJourneyProgress(stateWithRenown(-3))
    const beyondTarget = getCrambleJourneyProgress(stateWithRenown(52))

    expect(beforeStart).toEqual(
      expect.objectContaining({
        percent: 0,
        ratio: 0,
        separationPercent: CRAMBLE_JOURNEY.startSeparationPercent,
        knightBottomPercent: CRAMBLE_JOURNEY.startBottomPercent,
        knightScale: CRAMBLE_JOURNEY.startScale,
      }),
    )
    expect(beyondTarget).toEqual(
      expect.objectContaining({
        percent: 100,
        ratio: 1,
        separationPercent: CRAMBLE_JOURNEY.endSeparationPercent,
        knightBottomPercent: CRAMBLE_JOURNEY.endBottomPercent,
        knightScale: CRAMBLE_JOURNEY.endScale,
      }),
    )
  })

  it('keeps scenic distance moving while rank-gated chapter progress plateaus', () => {
    const chapterAt28 = getCrambleChapterProgress(stateWithRenown(28))
    const chapterAt34 = getCrambleChapterProgress(stateWithRenown(34))
    const journeyAt28 = getCrambleJourneyProgress(stateWithRenown(28))
    const journeyAt34 = getCrambleJourneyProgress(stateWithRenown(34))

    expect(chapterAt28.percent).toBe(80)
    expect(chapterAt34.percent).toBe(80)
    expect(journeyAt28.percent).toBe(80)
    expect(journeyAt34.percent).toBe(97)
    expect(journeyAt34.separationPercent).toBeGreaterThan(
      journeyAt28.separationPercent,
    )
  })

  it('has only the requested, valid scheduled habits', () => {
    const ids = crambleQuests.map((quest) => quest.id)
    expect(ids).toEqual([
      'first-draught',
      'sunward-tablet',
      'training-yard',
      'provisioners-plate',
      'evening-seal',
    ])
    expect(ids).not.toContain('hanas-sigil')
    expect(new Set(ids).size).toBe(ids.length)

    crambleQuests.forEach((quest) => {
      expect(quest.id.length).toBeGreaterThan(0)
      expect(quest.title.length).toBeGreaterThan(0)
      expect(quest.description.length).toBeGreaterThan(0)
      expect(quest.group).toBe('daily')
      expect(['easy', 'medium', 'hard']).toContain(quest.difficulty)
      expect(quest.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(quest.minLevel).toBe(1)
      expect(quest.required).toBe(true)
      expect(quest.durationDays).toBeUndefined()
      expect(hasValidQuestSchedule(quest)).toBe(true)
    })
  })

  it('keeps Chronicle copy original, indirect, and improvement-focused', () => {
    const ids = crambleChronicles.map((line) => line.id)
    const forbidden =
      /game of thrones|harry potter|kingkiller|breakup|heartbreak|\bher\b|\blove\b/i

    expect(crambleChronicles.length).toBeGreaterThanOrEqual(15)
    expect(new Set(ids).size).toBe(ids.length)
    crambleChronicles.forEach((line) => {
      expect(line.text.length).toBeGreaterThan(20)
      expect(line.text).not.toMatch(forbidden)
    })
  })
})
