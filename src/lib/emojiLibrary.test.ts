import { describe, expect, it, vi } from 'vitest'
import {
  chooseRandomEmoji,
  getDefaultEmoji,
  getEmojiChoices,
  resolveInitialEmoji,
} from './emojiLibrary'

describe('profile emoji library', () => {
  it('keeps distinct, labelled Hana and Cramble collections', () => {
    const hana = getEmojiChoices('hana')
    const cramble = getEmojiChoices('cramble')

    expect(hana.length).toBeGreaterThanOrEqual(16)
    expect(cramble.length).toBeGreaterThanOrEqual(16)
    expect(hana.every(({ emoji, label }) => emoji && label)).toBe(true)
    expect(cramble.every(({ emoji, label }) => emoji && label)).toBe(true)
    expect(hana.map(({ emoji }) => emoji)).not.toEqual(
      cramble.map(({ emoji }) => emoji),
    )
  })

  it('uses a random create value once while preserving an edit value', () => {
    const random = vi.fn(() => 0.5)
    const initialCreateValue = resolveInitialEmoji('hana', undefined, random)

    // The dialog stores this resolved value through a lazy useState initializer;
    // subsequent renders reuse it instead of consulting randomness again.
    const hanaChoices = getEmojiChoices('hana')
    expect(initialCreateValue).toBe(
      hanaChoices[Math.floor(hanaChoices.length * 0.5)].emoji,
    )
    expect(random).toHaveBeenCalledTimes(1)

    const editRandom = vi.fn(() => 0.9)
    expect(resolveInitialEmoji('cramble', '  🧪  ', editRandom)).toBe('🧪')
    expect(editRandom).not.toHaveBeenCalled()
  })

  it('rerolls to a different curated value and clamps injected randomness', () => {
    const first = getDefaultEmoji('cramble')
    expect(chooseRandomEmoji('cramble', first, () => 0)).not.toBe(first)
    expect(chooseRandomEmoji('hana', undefined, () => Number.NaN)).toBe(
      getDefaultEmoji('hana'),
    )
    expect(chooseRandomEmoji('hana', undefined, () => 2)).toBe(
      getEmojiChoices('hana').at(-1)?.emoji,
    )
  })
})
