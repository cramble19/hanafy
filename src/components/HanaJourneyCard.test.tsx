import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createStartedHanaState,
  getLevelProgress,
  getSpringArcProgress,
} from '@/lib/hanaGame'
import { HanaJourneyCard } from './HanaJourneyCard'

describe('HanaJourneyCard', () => {
  it('shows compact overall Spring progress and next-level details', () => {
    const game = {
      ...createStartedHanaState('2026-08-11'),
      totalFlowers: 18,
    }

    const html = renderToStaticMarkup(
      <HanaJourneyCard
        totalFlowers={game.totalFlowers}
        levelProgress={getLevelProgress(game.totalFlowers)}
        springArc={getSpringArcProgress(game)}
      />,
    )

    expect(html).toContain('Your journey')
    expect(html).toContain('Level 3 · Growing rhythm')
    expect(html).toContain('18 flowers gathered')
    expect(html).toContain('51%')
    expect(html).toContain('4 more to Level 4')
    expect(html).toContain('aria-valuenow="18"')
    expect(html).toContain('hana-journey-track')
    expect(html).not.toContain('hana-journey-ring')
    expect(html).not.toContain('hana-journey-milestone')
    expect(html).not.toContain('View garden')
  })

  it('shows the completed Spring state without exceeding the progress maximum', () => {
    const game = {
      ...createStartedHanaState('2026-08-11'),
      totalFlowers: 52,
    }

    const html = renderToStaticMarkup(
      <HanaJourneyCard
        totalFlowers={game.totalFlowers}
        levelProgress={getLevelProgress(game.totalFlowers)}
        springArc={getSpringArcProgress(game)}
      />,
    )

    expect(html).toContain('Level 6 · In full bloom')
    expect(html).toContain('Spring is complete')
    expect(html).toContain('aria-valuemax="35"')
    expect(html).toContain('aria-valuenow="35"')
  })
})
