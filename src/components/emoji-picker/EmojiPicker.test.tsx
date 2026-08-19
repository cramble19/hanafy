import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmojiPicker, nextEmojiChoiceIndex } from './EmojiPicker'

describe('EmojiPicker', () => {
  it('exposes a labelled selection, pressed state, reroll, and live status', () => {
    const html = renderToStaticMarkup(
      <EmojiPicker
        profile="hana"
        value="🌸"
        label="Quest icon"
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('<legend class="emoji-picker__legend">Quest icon</legend>')
    expect(html).toContain('aria-label="Cherry blossom: 🌸"')
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(/aria-label="Cherry blossom: 🌸"[^>]*aria-checked="true"/)
    expect(html.match(/tabindex="-1"/g)?.length).toBeGreaterThan(1)
    expect(html).toContain('aria-label="Surprise me with another icon.')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Cherry blossom selected.')
  })

  it('keeps an existing non-library icon available during editing', () => {
    const html = renderToStaticMarkup(
      <EmojiPicker
        profile="cramble"
        value="🪨"
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Current icon: 🪨"')
    expect(html).toMatch(/aria-label="Current icon: 🪨"[^>]*aria-checked="true"/)
  })

  it('keeps the source icon available while editing an override', () => {
    const html = renderToStaticMarkup(
      <EmojiPicker
        profile="hana"
        value="🦋"
        additionalChoices={[{ emoji: '👟', label: 'Original icon' }]}
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Original icon: 👟"')
    expect(html).toContain('aria-label="Butterfly: 🦋"')
  })

  it('wraps roving keyboard selection and supports Home and End', () => {
    expect(nextEmojiChoiceIndex(0, 'ArrowLeft', 4)).toBe(3)
    expect(nextEmojiChoiceIndex(3, 'ArrowRight', 4)).toBe(0)
    expect(nextEmojiChoiceIndex(2, 'Home', 4)).toBe(0)
    expect(nextEmojiChoiceIndex(1, 'End', 4)).toBe(3)
    expect(nextEmojiChoiceIndex(1, 'Enter', 4)).toBeNull()
  })
})
