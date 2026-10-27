import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CounterDialog, LifetimePage } from './LifetimePage'

describe('Lifetime quiet glass cards', () => {
  it('keeps full long descriptions and later records inside a keyboard-scrollable body without changing data', () => {
    const note = 'A long dream with every detail preserved.\n'.repeat(45)
    const counter = { id: 'dream', title: 'Dream', description: note, startingTotal: 3, startingDescription: note, createdDate: '2026-01-01', entries: [
      { id: 'one', date: '2026-10-27', amount: 1, note },
      { id: 'two', date: '2026-10-26', amount: 1, note: 'Second dream remains readable.' },
    ] }
    const before = JSON.stringify(counter)
    const onChange = vi.fn()
    const html = renderToStaticMarkup(<CounterDialog counter={counter} today="2026-10-27" onChange={onChange} onClose={vi.fn()} />)
    expect(html).toContain('class="lifetime-dialog-body" role="region" aria-label="Counter content" tabindex="0"')
    expect(html.indexOf('Close counter')).toBeLessThan(html.indexOf('lifetime-dialog-body'))
    expect(html.split(note)).toHaveLength(5) // description, baseline, note and accessible edit label
    expect(html).toContain('Second dream remains readable.')
    expect(html).toContain('5<small>times')
    expect(html).toContain('lifetime-entry-actions')
    expect(JSON.stringify(counter)).toBe(before)
    expect(onChange).not.toHaveBeenCalled()
  })
  it('uses the same scroll region for the add-counter form', () => {
    const html = renderToStaticMarkup(<CounterDialog today="2026-10-27" onChange={vi.fn()} onClose={vi.fn()} />)
    expect(html.indexOf('lifetime-dialog-body')).toBeLessThan(html.indexOf('<form'))
    expect(html).toContain('Save counter')
  })
  it('shows an optional event note and explicit save without recording on render', () => {
    const onChange = vi.fn()
    const html = renderToStaticMarkup(<CounterDialog today="2026-10-21" onChange={onChange} onClose={vi.fn()} initialRecording counter={{ id: 'one', title: 'Books', description: '', startingTotal: 12, createdDate: '2026-01-01', entries: [] }} />)
    expect(html).toContain('What prompted it?')
    expect(html).toContain('maxLength="2000"')
    expect(html).toContain('Save +1')
    expect(html).toContain('Cancel')
    expect(onChange).not.toHaveBeenCalled()
  })
  it('displays baseline context and dated notes separately and escapes their text', () => {
    const html = renderToStaticMarkup(<CounterDialog today="2026-10-21" onChange={vi.fn()} onClose={vi.fn()} counter={{ id: 'one', title: 'Books', description: '', startingTotal: 12, startingDescription: 'Earlier reading', createdDate: '2026-01-01', entries: [{ id: 'entry', date: '2026-10-20', amount: 1, note: '<script>context</script>' }] }} />)
    expect(html).toContain('Earlier reading')
    expect(html).toContain('dates unknown')
    expect(html).toContain('&lt;script&gt;context&lt;/script&gt;')
    expect(html).toContain('Edit record from 2026-10-20')
    expect(html).toContain('>Edit</button>')
    expect(html).toContain('Remove record from 2026-10-20')
  })
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
