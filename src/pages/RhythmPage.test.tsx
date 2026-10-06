import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RhythmPage } from './RhythmPage'
import { createStartedHanaState } from '@/lib/hanaGame'

describe('Rhythm page', () => {
  it('renders Cramble areas, five destinations, and dates without a search box or removed prefix', () => {
    const game=createStartedHanaState('2026-10-06')
    const noop=()=>{}
    const html=renderToStaticMarkup(<RhythmPage game={game} onCreateCategory={()=>({id:null,error:null})} onAssignCategory={()=>null} onToday={noop} onObservatory={noop} onSomeday={noop} onLedger={noop} syncStatus="disabled" hasPendingSave={false} saveConfirmedAt={null} onRetry={noop} />)
    for(const title of ['Movement','Care','Connection','Mind &amp; Play','Unsorted','Today','Observatory','Someday','Rhythm','Ledger']) expect(html).toContain(title)
    expect(html).not.toContain('Saved records')
    expect(html).not.toContain('type="search"')
    expect(html).not.toContain('Due Today')
    expect(html).toContain('aria-current="page"')
  })
})
