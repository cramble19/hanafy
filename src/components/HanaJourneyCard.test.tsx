import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createStartedHanaState,
  getLevelProgress,
  getSpringArcProgress,
} from '@/lib/hanaGame'
import { HanaJourneyCard } from './HanaJourneyCard'

describe('HanaJourneyCard', () => {
  it('shows overall Spring progress, level milestones, and next-level details', () => {
    const game = {
      ...createStartedHanaState('2026-08-11'),
      totalFlowers: 18,
    }

    const html = renderToStaticMarkup(
      <HanaJourneyCard
        totalFlowers={game.totalFlowers}
        levelProgress={getLevelProgress(game.totalFlowers)}
        springArc={getSpringArcProgress(game)}
        onOpenGarden={() => undefined}
      />,
    )

    expect(html).toContain('Your garden journey')
    expect(html).toContain('Level 3')
    expect(html).toContain('18 flowers')
    expect(html).toContain('17 flowers to complete Spring')
    expect(html).toContain('6 of 10 flowers collected toward Level 4')
    expect(html).toContain('aria-valuenow="18"')
    expect(html).toContain('View garden')
    expect(html.match(/hana-journey-ring-track/g)).toHaveLength(1)
    expect(html.match(/hana-journey-ring-progress/g)).toHaveLength(1)
    expect(html).not.toContain('hana-journey-vine')
    expect(html).not.toContain('hana-journey-ring-blossom')
    expect(html).not.toContain('hana-journey-petals')
    expect(html).not.toContain('Flower balance')
    expect(html).not.toContain('Next bloom')
    expect(html).not.toContain('What counts')
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
        onOpenGarden={() => undefined}
      />,
    )

    expect(html).toContain('Level 6')
    expect(html).toContain('Spring is in full bloom')
    expect(html).toContain('aria-valuemax="35"')
    expect(html).toContain('aria-valuenow="35"')
  })
})
