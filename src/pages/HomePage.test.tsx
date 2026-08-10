import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from '@/pages/HomePage'

const callbacks = {
  onSelectHana: vi.fn(),
  onSelectCramble: vi.fn(),
  onSelectTogether: vi.fn(),
}

describe('HomePage emotion marks', () => {
  it('does not add a placeholder when neither profile recorded today', () => {
    const html = renderToStaticMarkup(<HomePage {...callbacks} />)
    expect(html).not.toContain('home-emotion-status')
    expect(html).toContain('Whose')
    expect(html).toContain('day is it?')
    expect(html).toContain('See your shared rhythm')
  })

  it('adds only the two floating SVG states when emotions exist', () => {
    const html = renderToStaticMarkup(
      <HomePage
        {...callbacks}
        hanaEmotion="good"
        crambleEmotion="okay"
      />,
    )

    expect(html).toContain('home-emotion-status-hana')
    expect(html).toContain('data-profile="hana"')
    expect(html).toContain('data-emotion="good"')
    expect(html).toContain('home-emotion-status-cramble')
    expect(html).toContain('data-profile="cramble"')
    expect(html).toContain('data-emotion="okay"')
    expect(html).not.toContain('Good today')
    expect(html).not.toContain('Okay today')
  })
})
