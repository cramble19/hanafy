import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SomedayPage } from './SomedayPage'
import type { SomedayItem } from '@/types'

const items: SomedayItem[] = [
  {
    id: 'anytime',
    title: 'See cherry blossoms in Japan',
    timing: 'timeless',
    targetAge: null,
    createdDate: '2026-08-01',
    completedDate: null,
  },
  {
    id: 'forty',
    title: 'Start a small garden',
    timing: 'beforeAge',
    targetAge: 40,
    createdDate: '2026-08-01',
    completedDate: null,
  },
  {
    id: 'thirty-five',
    title: 'Learn to swim',
    timing: 'beforeAge',
    targetAge: 35,
    createdDate: '2026-08-01',
    completedDate: null,
  },
  {
    id: 'complete',
    title: 'Take dad to the mountains',
    timing: 'timeless',
    targetAge: null,
    createdDate: '2026-08-01',
    completedDate: '2026-08-16',
  },
]

describe('SomedayPage', () => {
  it.each(['hana', 'cramble'] as const)('uses the shared Someday structure for %s', (profile) => {
    const html = renderToStaticMarkup(
      <SomedayPage
        profile={profile}
        items={items}
        onAdd={() => null}
        onToggle={() => undefined}
        onBack={() => undefined}
        onOpenToday={() => undefined}
        onOpenDestination={() => undefined}
        onOpenLedger={() => undefined}
      />,
    )
    expect(html).toContain('Someday')
    expect(html).toContain('Anytime')
    expect(html.indexOf('Before 35')).toBeLessThan(html.indexOf('Before 40'))
    expect(html).toContain('Memories made')
    expect(html.indexOf('Memories made')).toBeLessThan(html.indexOf('Add something'))
    expect(html).toContain('Completed · Aug 16, 2026')
    expect(html).toContain(profile === 'hana' ? 'Garden' : 'Observatory')
    expect(html).not.toContain('🌱')
  })
})
