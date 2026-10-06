import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CrambleNavigation } from './CrambleNavigation'
import { readCrambleRoute, type CrambleView } from '@/hooks/useCrambleNavigation'

describe('shared Cramble navigation', () => {
  it('uses the same five destinations on every Cramble page and highlights the parent for details', () => {
    const views: CrambleView[] = ['tracker','observatory','someday','rhythm','ledger','ledgerDetail','emotionHistory']
    for (const view of views) {
      const html = renderToStaticMarkup(<CrambleNavigation view={view} onNavigate={() => {}} />)
      for (const label of ['Today','Observatory','Someday','Rhythm','Ledger']) expect(html).toContain(label)
      expect(html.match(/<button/g)).toHaveLength(5)
      expect(html.match(/aria-current="page"/g)).toHaveLength(1)
      expect(html).not.toContain('Add habit')
      expect(html).not.toContain('Back')
    }
  })
  it('rejects unrelated or malformed browser-history entries', () => {
    for (const entry of [null, {}, { hanafyCramble: {view:'unknown',depth:0} }, {hanafyCramble:{view:'tracker',depth:-1}}]) {
      expect(readCrambleRoute(entry)).toBeNull()
    }
    expect(readCrambleRoute({hanafyCramble:{view:'rhythm',depth:2,area:'movement'}})).toMatchObject({view:'rhythm',area:'movement',dialogs:0})
  })
})
