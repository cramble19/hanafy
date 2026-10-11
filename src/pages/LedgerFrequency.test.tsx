import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createStartedHanaState } from '@/lib/hanaGame'
import type { HanaGameState, OpenActivity } from '@/types'
import { HabitLedgerPage } from './CrambleLedgerPage'

function fixture(): HanaGameState {
  const titles = ['Zero activity', 'Large count', 'Frequent check', 'Tied check', 'Old activity', 'Archived activity']
  const openActivities: OpenActivity[] = titles.map((title, i) => ({
    id: `open-cramble-${i}`, custom: true, title, description: 'Example',
    color: '#d6a653', kind: i === 1 ? 'count' : 'check', unit: null, createdDate: '2026-09-01',
  }))
  return {
    ...createStartedHanaState('2026-09-01'), currentDate: '2026-10-11', openActivities,
    openActivityLogs: {
      '2026-10-04': { 'open-cramble-4': 1 },
      '2026-10-05': { 'open-cramble-2': 1, 'open-cramble-3': 1, 'open-cramble-5': 1 },
      '2026-10-11': { 'open-cramble-1': 100, 'open-cramble-2': 1, 'open-cramble-3': 1 },
      '2026-10-12': { 'open-cramble-0': 1, 'open-cramble-4': 1 },
    },
    habitSettings: { 'open-cramble-5': { archivedAt: '2026-10-06', cue: '', reminder: { enabled: false, time: null }, pauses: [] } },
  }
}
function render(game: HanaGameState, profileId: 'hana' | 'cramble') {
  return renderToStaticMarkup(<HabitLedgerPage game={game} baseQuests={[]} profileId={profileId} onOpenQuest={() => {}} onOpenEmotion={() => {}} />)
}
describe('Ledger seven-day frequency ordering', () => {
  it('sorts Cramble by active dates, includes today and six prior days, preserves ties and archives separately', () => {
    const game = fixture(), before = JSON.stringify(game)
    const html = render(game, 'cramble')
    const order = ['Frequent check', 'Tied check', 'Large count', 'Zero activity', 'Old activity', 'Archived anytime records', 'Archived activity']
    const positions = order.map(title => html.indexOf(title))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(JSON.stringify(game)).toBe(before)
  })
  it('leaves Hana in its existing catalog order', () => {
    const html = render(fixture(), 'hana')
    const positions = ['Zero activity', 'Large count', 'Frequent check', 'Tied check', 'Old activity'].map(title => html.indexOf(title))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
