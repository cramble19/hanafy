import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackfillDialog } from './BackfillDialog'
import { createStartedHanaState } from '@/lib/hanaGame'

const noop = () => null
const props = { game: { ...createStartedHanaState('2026-10-01'), currentDate:'2026-10-06', dailyEmotions:{'2026-10-05':'good' as const} },
  baseQuests:[], onClose:noop, onRecord:noop, onUndo:noop, onRecordActivity:noop, onUndoActivity:noop }
describe('recent-day emotion form', () => {
  it('shows the date-specific picker even without any eligible habits', () => {
    const html = renderToStaticMarkup(<BackfillDialog {...props} profile="cramble" onRecordEmotion={noop} />)
    expect(html).toContain('How did this day feel?')
    expect(html).toContain('Emotion for Monday, October 5')
    expect(html).toContain('Good, selected')
    expect(html).toContain('Bright')
    expect(html).not.toContain('Today&#x27;s emotion')
  })
  it('does not change Hana’s recent-day form', () => {
    const html = renderToStaticMarkup(<BackfillDialog {...props} profile="hana" />)
    expect(html).not.toContain('How did this day feel?')
  })
})
