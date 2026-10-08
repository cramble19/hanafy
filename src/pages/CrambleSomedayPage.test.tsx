import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CrambleSomedayPage } from './CrambleSomedayPage'

describe('Cramble Someday categories', () => {
  it('renders all waiting entries and memories, their dates, and an accessible edit action for each', () => {
    const items = Array.from({ length: 83 }, (_, i) => ({ id: `item-${i}`, title: `Wish ${i}`, timing: 'timeless' as const, targetAge: null, createdDate: '2026-08-01', completedDate: i >= 60 ? '2026-09-25' : null }))
    const html = renderToStaticMarkup(<CrambleSomedayPage items={items}
      settings={{ version: 1, categories: { travel: 'Travel & Experiences' }, assignments: { 'item-0': 'travel' } }}
      onAdd={() => null} onUpdate={() => null} onCategoryChange={() => null} onDelete={() => {}} onToggle={() => {}} />)
    expect(html).toContain('60 things waiting')
    expect(html).toContain('23 memories made')
    expect(html).toContain('Completed · Sep 25, 2026')
    expect(html).toContain('Unsorted')
    expect(html).toContain('Search Someday')
    expect(html).toContain('Open Someday category settings')
    expect(html).toContain('By age')
    for (const item of items) expect(html).toContain(`aria-label="Edit ${item.title}"`)
  })
})
