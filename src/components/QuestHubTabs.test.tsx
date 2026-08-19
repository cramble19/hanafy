import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  QuestHubTabs,
  nextQuestHubView,
  questHubPanelId,
  questHubTabId,
} from './QuestHubTabs'

describe('QuestHubTabs', () => {
  it('renders the approved two-card Garden switcher with connected panels', () => {
    const html = renderToStaticMarkup(
      <QuestHubTabs
        profile="hana"
        value="destination"
        surface="light"
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Garden views"')
    expect(html).toContain(`id="${questHubTabId('hana', 'destination')}"`)
    expect(html).toContain(
      `aria-controls="${questHubPanelId('hana', 'quests')}"`,
    )
    expect(html).toContain('Garden')
    expect(html).toContain('Today&#x27;s quests')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('tabindex="-1"')
  })

  it('supports wrapped arrow navigation plus Home and End', () => {
    expect(nextQuestHubView('destination', 'ArrowLeft')).toBe('quests')
    expect(nextQuestHubView('quests', 'ArrowRight')).toBe('destination')
    expect(nextQuestHubView('quests', 'Home')).toBe('destination')
    expect(nextQuestHubView('destination', 'End')).toBe('quests')
    expect(nextQuestHubView('destination', 'Enter')).toBeNull()
  })

  it('keeps Hana accents on the dark Garden surface', () => {
    const html = renderToStaticMarkup(
      <QuestHubTabs
        profile="hana"
        value="destination"
        surface="dark"
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('rgba(168,200,152,0.78)')
    expect(html).toContain('#b8d5aa')
    expect(html).not.toContain('var(--cramble-brass)')
  })
})
