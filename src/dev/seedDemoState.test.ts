import { describe, expect, it } from 'vitest'
import { crambleQuests } from '@/data/crambleQuests'
import { quests as hanaQuests } from '@/data/quests'
import {
  CRAMBLE_PENDING_STORAGE_KEY,
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import { parseStoredHanaState, STORAGE_KEY } from '@/lib/hanaGame'
import { HANA_PENDING_STORAGE_KEY } from '@/lib/profileCache'
import { createDemoProfileStates, seedLocalDemoProfiles } from './seedDemoState'

describe('localhost demo profiles', () => {
  it('creates started profiles with mixed quest and anytime-log states', () => {
    const { hana, cramble } = createDemoProfileStates('2026-08-19')

    expect(hana.startDate).toBeTruthy()
    expect(cramble.startDate).toBeTruthy()
    expect(hana.customHabits).toHaveLength(2)
    expect(cramble.customHabits).toHaveLength(2)
    expect(Object.values(hana.dailyCompletions[hana.currentDate])).toContain(true)
    expect(Object.keys(hana.dailyCompletions[hana.currentDate])).not.toHaveLength(
      hana.activeDailyQuests[hana.currentDate].length,
    )
    expect(hana.openActivityLogs[hana.currentDate]).toMatchObject({
      'custom-hana-energy-check-in': 4,
      'custom-hana-productive-day': 1,
    })
    expect(cramble.openActivityLogs[cramble.currentDate]).toMatchObject({
      'open-cramble-demo-pages': 12,
      'open-cramble-demo-campfire-tea': 1,
    })
    expect(cramble.openActivityLogs[cramble.currentDate])
      .not.toHaveProperty('open-cramble-demo-kind-moment')
    expect(hana.totalFlowers).toBeGreaterThan(0)
    expect(cramble.totalFlowers).toBeGreaterThan(0)
  })

  it('writes only the two local caches and clears pending cloud envelopes', () => {
    const values = new Map<string, string>([
      [HANA_PENDING_STORAGE_KEY, 'pending'],
      [CRAMBLE_PENDING_STORAGE_KEY, 'pending'],
    ])
    const storage = {
      setItem(key: string, value: string) {
        values.set(key, value)
      },
      removeItem(key: string) {
        values.delete(key)
      },
    }

    seedLocalDemoProfiles(storage, '2026-08-19')

    expect(values.has(HANA_PENDING_STORAGE_KEY)).toBe(false)
    expect(values.has(CRAMBLE_PENDING_STORAGE_KEY)).toBe(false)
    expect(
      parseStoredHanaState(values.get(STORAGE_KEY) ?? null, hanaQuests, '2026-08-19')
        .startDate,
    ).toBeTruthy()
    expect(
      parseStoredHanaState(
        values.get(CRAMBLE_STORAGE_KEY) ?? null,
        crambleQuests,
        '2026-08-19',
        CRAMBLE_QUEST_PLAN_OPTIONS,
      ).startDate,
    ).toBeTruthy()
  })
})
