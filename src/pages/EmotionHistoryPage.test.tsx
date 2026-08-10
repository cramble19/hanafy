import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createStartedHanaState } from '@/lib/hanaGame'
import { EmotionHistoryPage } from '@/pages/EmotionHistoryPage'

describe('EmotionHistoryPage', () => {
  it('renders the neutral five-level Hana graph and summary', () => {
    const game = {
      ...createStartedHanaState('2026-07-01'),
      currentDate: '2026-08-10',
      dailyEmotions: {
        '2026-08-08': 'low' as const,
        '2026-08-10': 'good' as const,
      },
    }
    const html = renderToStaticMarkup(
      <EmotionHistoryPage
        game={game}
        profileId="hana"
        onBack={vi.fn()}
      />,
    )

    expect(html).toContain('Emotion history')
    expect(html).toContain('A gentle record, never a score.')
    expect(html.indexOf('Bright')).toBeLessThan(html.indexOf('Heavy'))
    expect(html).toContain('Blank dates are neutral gaps.')
    expect(html).toContain('Days recorded')
    expect(html).not.toContain('success rate')
  })

  it('uses Cramble archive copy without changing the graph structure', () => {
    const game = {
      ...createStartedHanaState('2026-08-01'),
      currentDate: '2026-08-10',
      dailyEmotions: { '2026-08-10': 'okay' as const },
    }
    const html = renderToStaticMarkup(
      <EmotionHistoryPage
        game={game}
        profileId="cramble"
        onBack={vi.fn()}
      />,
    )

    expect(html).toContain('cramble-archive-shell')
    expect(html).toContain('A field record, never a judgment.')
    expect(html).toContain('Past 90 days')
  })
})
