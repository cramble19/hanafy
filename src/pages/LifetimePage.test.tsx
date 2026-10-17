import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LifetimePage } from './LifetimePage'

describe('Lifetime quiet glass cards', () => {
  it('exposes details and editing separately from recording, showing the latest date', () => {
    const html = renderToStaticMarkup(<LifetimePage today="2026-10-17" onChange={vi.fn()} counters={[{
      id: 'one', title: 'Books finished', description: '', startingTotal: 10, createdDate: '2026-01-01',
      entries: [{ id: 'new', date: '2026-10-12', amount: 1 }, { id: 'old', date: '2026-10-02', amount: 1 }],
    }]} />)
    expect(html).toContain('View details and edit Books finished')
    expect(html).toContain('Record one occurrence of Books finished')
    expect(html).toContain('Last recorded')
    expect(html).toContain('12<small>times')
    expect(html).not.toContain('Details &amp; history')
    expect(html).not.toContain('Lifetime counter</p>')
  })
  it('does not invent a last occurrence for imported starting totals', () => {
    const html = renderToStaticMarkup(<LifetimePage today="2026-10-17" onChange={vi.fn()} counters={[{
      id: 'one', title: 'Books', description: '', startingTotal: 10, createdDate: '2026-01-01', entries: [],
    }]} />)
    expect(html).toContain('No dated records yet')
  })
})
