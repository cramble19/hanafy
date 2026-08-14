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
    expect(html).toContain(
      'Hana 3 days \u00b7 Cramble 2 days recorded. Blank days stay neutral.',
    )

    expect(html.match(/together-emotion-dot-hana/g)).toHaveLength(3)
    expect(html.match(/together-emotion-dot-cramble/g)).toHaveLength(2)
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
    expect(html).toContain(
      'Hana 0 days \u00b7 Cramble 0 days recorded. Blank days stay neutral.',
    )
    expect(html).not.toContain('together-emotion-dot-hana')
    expect(html).not.toContain('together-emotion-dot-cramble')
  })
})
