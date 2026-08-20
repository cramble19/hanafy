import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  getNextMemoryImageIndex,
  HomePage,
  MemoryPhotoCarousel,
} from '@/pages/HomePage'

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
    expect(html).toContain('>Together<')
    expect(html).not.toContain('See your shared rhythm')
    expect(html).not.toContain('together-mark-vine')
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

describe('HomePage hidden memory carousel', () => {
  it('renders both memories while exposing only the active image', () => {
    const html = renderToStaticMarkup(<MemoryPhotoCarousel activeIndex={1} />)

    expect(html).toContain('/couple-watercolor.png')
    expect(html).toContain('/couple-hands.jpg')
    expect(html).toContain('alt="Our hands held together"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('<button')
  })

  it('alternates between the two images', () => {
    expect(getNextMemoryImageIndex(0)).toBe(1)
    expect(getNextMemoryImageIndex(1)).toBe(0)
  })
})
