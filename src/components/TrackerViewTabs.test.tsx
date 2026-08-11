import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  TrackerViewTabs,
  trackerViewPanelId,
  trackerViewTabId,
} from './TrackerViewTabs'

describe('TrackerViewTabs', () => {
  it('connects Hana quest and anytime tabs to their panels', () => {
    const html = renderToStaticMarkup(
      <TrackerViewTabs profile="hana" value="quests" onChange={() => undefined} />,
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain(`id="${trackerViewTabId('hana', 'quests')}"`)
    expect(html).toContain(`aria-controls="${trackerViewPanelId('hana', 'anytime')}"`)
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('tabindex="-1"')
  })

  it('selects the Cramble anytime tab without changing its shared wording', () => {
    const html = renderToStaticMarkup(
      <TrackerViewTabs profile="cramble" value="anytime" onChange={() => undefined} />,
    )

    expect(html).toContain('tracker-view-tabs-cramble')
    expect(html).toContain('Today&#x27;s quests')
    expect(html).toContain('Anytime log')
    expect(html).toMatch(
      /id="cramble-anytime-view-tab"[^>]*aria-selected="true"[^>]*>Anytime log<\/button>/,
    )
  })
})
