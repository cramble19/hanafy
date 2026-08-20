import { describe, expect, it } from 'vitest'
import { quests } from '@/data/quests'
import {
  createCustomHabitQuest,
  updateCustomHabitQuest,
  type NewHabitInput,
} from '@/lib/customHabits'
import { getDefaultEmoji } from '@/lib/emojiLibrary'
import { updateHabitWording } from '@/lib/habitLifecycle'
import {
  createStartedHanaState,
  getQuestCatalog,
  parseStoredHanaState,
} from '@/lib/hanaGame'
import {
  updateOpenActivityDefinition,
} from '@/lib/openActivities'

describe('emoji persistence', () => {
  it('creates and edits a custom scheduled quest icon', () => {
    const created = createCustomHabitQuest(
      habitInput({ emoji: '🍓' }),
      'hana',
      '2026-08-19',
      [],
      'custom-hana-emoji-test',
    )
    const updated = updateCustomHabitQuest(
      created,
      habitInput({ emoji: '🦋' }),
    )

    expect(created.emoji).toBe('🍓')
    expect(updated.emoji).toBe('🦋')
  })

  it('stores a built-in quest override and restores it from saved state', () => {
    const builtIn = quests[0]
    const state = updateHabitWording(
      createStartedHanaState('2026-08-19'),
      builtIn.id,
      {
        title: builtIn.title,
        description: builtIn.description,
        emoji: '🐝',
      },
    )

    expect(getQuestCatalog(quests, state).find(({ id }) => id === builtIn.id)?.emoji)
      .toBe('🐝')

    const restored = parseStoredHanaState(
      JSON.stringify(state),
      quests,
      '2026-08-19',
    )
    expect(restored.habitSettings?.[builtIn.id]?.emojiOverride).toBe('🐝')
    expect(
      getQuestCatalog(quests, restored).find(({ id }) => id === builtIn.id)?.emoji,
    ).toBe('🐝')
  })

  it('drops legacy anytime-log icons without losing definitions or logs', () => {
    const legacyId = 'open-cramble-legacy-icon'
    const restored = parseStoredHanaState(
      JSON.stringify({
        ...createStartedHanaState('2026-08-19'),
        openActivities: [{
          id: legacyId,
          custom: true,
          title: 'Read outside',
          description: 'Read a few pages outdoors.',
          emoji: '📖',
          color: '#8baebb',
          kind: 'check',
          unit: null,
          createdDate: '2026-08-19',
        }],
        openActivityLogs: {
          '2026-08-19': { [legacyId]: 1 },
        },
      }),
      [],
      '2026-08-19',
    )

    expect(restored.openActivities).toEqual([
      expect.objectContaining({ id: legacyId, title: 'Read outside' }),
    ])
    expect(restored.openActivities[0]).not.toHaveProperty('emoji')
    expect(restored.openActivityLogs).toEqual({
      '2026-08-19': { [legacyId]: 1 },
    })
  })

  it('keeps edits to a seeded Hana anytime log after normalization', () => {
    const seeded = parseStoredHanaState(
      JSON.stringify(createStartedHanaState('2026-08-19')),
      quests,
      '2026-08-19',
    )
    const activity = seeded.openActivities.find(
      ({ id }) => id === 'custom-hana-productive-day',
    )
    expect(activity).toBeDefined()

    const updated = updateOpenActivityDefinition(activity!, {
      title: 'A day worth celebrating',
      description: 'Record a day that felt meaningfully productive.',
      kind: 'check',
    })
    const restored = parseStoredHanaState(
      JSON.stringify({
        ...seeded,
        openActivities: seeded.openActivities.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      }),
      quests,
      '2026-08-19',
    )

    expect(
      restored.openActivities.find(({ id }) => id === updated.id),
    ).toEqual(expect.objectContaining({
      title: 'A day worth celebrating',
      description: 'Record a day that felt meaningfully productive.',
    }))
    expect(
      restored.openActivities.find(({ id }) => id === updated.id),
    ).not.toHaveProperty('emoji')
  })

  it('keeps scheduled-quest creation fallbacks deterministic', () => {
    expect(
      createCustomHabitQuest(
        habitInput(),
        'hana',
        '2026-08-19',
        [],
        'custom-hana-default-emoji',
      ).emoji,
    ).toBe(getDefaultEmoji('hana'))
  })
})

function habitInput(overrides: Partial<NewHabitInput> = {}): NewHabitInput {
  return {
    title: 'Fresh air',
    description: 'Spend a few intentional minutes outside.',
    frequency: 'oncePerPeriod',
    target: 1,
    periodLength: 1,
    periodUnit: 'days',
    difficulty: 'easy',
    ...overrides,
  }
}
