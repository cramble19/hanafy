import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createStartedHanaState } from '@/lib/hanaGame'
import { TogetherPage } from '@/pages/TogetherPage'

describe('TogetherPage emotional weather', () => {
  it('renders both neutral emotion paths with the independent seven-day range', () => {
    const hanaGame = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-14',
      dailyEmotions: {
        '2026-08-08': 'bright' as const,
        '2026-08-09': 'good' as const,
        '2026-08-11': 'okay' as const,
      },
    }
    const crambleGame = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-14',
      dailyEmotions: {
        '2026-08-09': 'low' as const,
        '2026-08-12': 'heavy' as const,
      },
    }

    const html = renderToStaticMarkup(
      <TogetherPage
        hanaGame={hanaGame}
        crambleGame={crambleGame}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('Emotional weather')
    expect(html).toContain('How both days have felt')
    expect(html).toContain('aria-label="Emotion chart range"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>7 days<\/button>/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>30 days<\/button>/)
    expect(html).toContain('Aug 8–Today')
    expect(html).toContain('Every date stays visible')
    expect(html).toMatch(
      /Full 7-day window:<\/strong> Hana 3 days · Cramble 2 days recorded\. Blank days stay neutral\./,
    )

    expect(html.match(/together-emotion-day-guide/g)).toHaveLength(7)
    expect(html.match(/together-emotion-symbol-hana/g)).toHaveLength(3)
    expect(html.match(/together-emotion-symbol-cramble/g)).toHaveLength(2)
    expect(html).toContain('together-emotion-legend-icon-hana')
    expect(html).toContain('together-emotion-legend-icon-cramble')
    expect(html).toContain(
      'August 10, 2026: Hana not recorded; Cramble not recorded.',
    )
    expect(html.indexOf('Bright')).toBeLessThan(html.indexOf('Heavy'))
  })

  it('keeps an empty range factual instead of inferring an emotion', () => {
    const hanaGame = {
      ...createStartedHanaState('2026-08-08'),
      currentDate: '2026-08-14',
    }
    const crambleGame = {
      ...createStartedHanaState('2026-08-08'),
      currentDate: '2026-08-14',
    }

    const html = renderToStaticMarkup(
      <TogetherPage
        hanaGame={hanaGame}
        crambleGame={crambleGame}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('Emotion history is still gathering')
    expect(html).toMatch(
      /Full 7-day window:<\/strong> Hana 0 days · Cramble 0 days recorded\. Blank days stay neutral\./,
    )
    expect(html).not.toContain('together-emotion-dot-hana')
    expect(html).not.toContain('together-emotion-dot-cramble')
    expect(html).not.toContain('together-emotion-symbol-hana')
    expect(html).not.toContain('together-emotion-symbol-cramble')
  })
})
