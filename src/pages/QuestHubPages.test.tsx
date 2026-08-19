import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CrambleQuestHubPanelProps } from '@/components/CrambleQuestHubPanel'
import type { HanaQuestHubPanelProps } from '@/components/HanaQuestHubPanel'
import { crambleQuests } from '@/data/crambleQuests'
import { quests } from '@/data/quests'
import { CRAMBLE_QUEST_PLAN_OPTIONS } from '@/lib/crambleGame'
import {
  createStartedHanaState,
  syncActiveQuestPlan,
} from '@/lib/hanaGame'
import { GardenPage } from './GardenPage'
import { ObservatoryPage } from './ObservatoryPage'

const sharedActions = {
  onToggle: () => undefined,
  onUndoOccurrence: () => undefined,
  onEditHabit: () => null,
  onPauseHabit: () => undefined,
  onResumeHabit: () => undefined,
  onArchiveHabit: () => undefined,
  onRestoreHabit: () => undefined,
  onDeleteHabit: () => undefined,
  onResumeTracking: () => undefined,
  onSkip: () => undefined,
} satisfies Omit<CrambleQuestHubPanelProps, 'game'>

describe('Garden and Observatory quest hubs', () => {
  it('opens Garden on the visualization and keeps the relocated Hana quest panel connected', () => {
    const game = syncActiveQuestPlan(
      createStartedHanaState('2026-08-19'),
      quests,
    )
    const hanaActions = {
      ...sharedActions,
      onActivateQuest: () => undefined,
      onToggleWeed: () => undefined,
    } satisfies Omit<HanaQuestHubPanelProps, 'game'>

    const html = renderToStaticMarkup(
      <GardenPage
        game={game}
        {...hanaActions}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Garden views"')
    expect(html).toMatch(
      /id="hana-destination-hub-tab"[^>]*aria-selected="true"/,
    )
    expect(html).toContain('id="hana-quests-hub-panel"')
    expect(html).toContain('Daily Quests')
    expect(html).not.toContain(
      "Each flower is planted from Hana's completed quests.",
    )
    expect(html).not.toContain('profile-action-bar')

    const completeHtml = renderToStaticMarkup(
      <GardenPage
        game={{ ...game, totalFlowers: 35 }}
        {...hanaActions}
        onBack={() => undefined}
      />,
    )

    expect(completeHtml).not.toContain(
      'Arc 1 is complete. The next season will ask for consistency and tougher choices.',
    )
  })

  it('keeps Cramble lessons in Observatory without nesting its old preview', () => {
    const game = syncActiveQuestPlan(
      createStartedHanaState('2026-08-19'),
      crambleQuests,
      CRAMBLE_QUEST_PLAN_OPTIONS,
    )

    const html = renderToStaticMarkup(
      <ObservatoryPage
        game={game}
        {...sharedActions}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Observatory views"')
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Lantern Observatory</h1>')
    expect(html).toContain('<h2')
    expect(html).toContain('The road remembers every step</h2>')
    expect(html).toMatch(
      /id="cramble-destination-hub-tab"[^>]*aria-selected="true"/,
    )
    expect(html).toContain('id="cramble-quests-hub-panel"')
    expect(html).toContain('Daily Lessons')
    expect(html).toContain('relative z-10 mt-7 overflow-hidden')
    expect(html).not.toContain('cramble-observatory-preview')
    expect(html).not.toContain('profile-action-bar')
  })
})
