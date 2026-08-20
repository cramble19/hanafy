import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { crambleQuests } from '@/data/crambleQuests'
import { quests } from '@/data/quests'
import { createStartedHanaState } from '@/lib/hanaGame'
import type { HanaGameState, OpenActivity, Quest } from '@/types'
import { HabitLedgerPage } from './CrambleLedgerPage'

const activity: OpenActivity = {
  id: 'quiet-tea',
  custom: true,
  title: 'Quiet tea',
  description: 'A small pause',
  color: '#78ab63',
  kind: 'check',
  unit: null,
  createdDate: '2026-08-19',
}

function renderLedger(profileId: 'hana' | 'cramble', baseQuests: Quest[]) {
  const dateKey = '2026-08-19'
  const game: HanaGameState = {
    ...createStartedHanaState(dateKey),
    openActivities: [activity],
    openActivityLogs: {
      [dateKey]: { [activity.id]: 1 },
    },
  }

  return renderToStaticMarkup(
    <HabitLedgerPage
      game={game}
      baseQuests={baseQuests}
      profileId={profileId}
      onBack={() => undefined}
      onOpenQuest={() => undefined}
      onOpenEmotion={() => undefined}
    />,
  )
}

describe('Ledger copy cleanup', () => {
  it.each([
    ['hana', quests],
    ['cramble', crambleQuests],
  ] as const)('keeps the %s Ledger concise without removing record labels', (profileId, baseQuests) => {
    const html = renderLedger(profileId, baseQuests)

    expect(html).not.toContain('The page is information—not judgment.')
    expect(html).not.toContain('Each mark is information—not judgment.')
    expect(html).not.toContain(
      'Only recorded days are marked. Blank days stay neutral.',
    )
    expect(html).not.toContain(
      'Open a quest to see each goal window and every recorded day.',
    )
    expect(html).toContain('1-day view · Blank days are neutral')
  })
})
