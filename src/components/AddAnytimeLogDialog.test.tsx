import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AddAnytimeLogDialog } from './AddAnytimeLogDialog'

describe('AddAnytimeLogDialog', () => {
  it.each(['hana', 'cramble'] as const)(
    'keeps the %s create form icon-free',
    (profile) => {
      const html = renderToStaticMarkup(
        <AddAnytimeLogDialog
          profile={profile}
          existingTitles={[]}
          initialView="anytime"
          onClose={vi.fn()}
          onChooseScheduled={vi.fn()}
          onSubmit={() => null}
        />,
      )

      expect(html).toContain('Record as')
      expect(html).toContain(profile === 'hana' ? 'Habit name' : 'Activity name')
      expect(html).not.toContain('Log icon')
      expect(html).not.toContain('emoji-picker')
      expect(html.indexOf('Record as')).toBeLessThan(
        html.indexOf(profile === 'hana' ? 'Habit name' : 'Activity name'),
      )
    },
  )

  it('keeps the edit form icon-free while preserving its saved wording', () => {
    const html = renderToStaticMarkup(
      <AddAnytimeLogDialog
        profile="cramble"
        mode="edit"
        existingTitles={[]}
        initialValue={{
          title: 'Pages read',
          description: 'Count each page read.',
          kind: 'count',
          unit: 'pages',
        }}
        onClose={vi.fn()}
        onChooseScheduled={vi.fn()}
        onSubmit={() => null}
      />,
    )

    expect(html).toContain('Pages read')
    expect(html).toContain('Count each page read.')
    expect(html).not.toContain('Log icon')
    expect(html).not.toContain('emoji-picker')
  })
})
