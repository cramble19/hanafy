import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CrambleSettingsContext, CrambleSharedSyncContext } from './CrambleSettings'
import { ProfileTopBar } from './ProfileTopBar'
import { CloudSyncNotice } from './CloudSyncNotice'
import { AddAnytimeLogDialog } from './AddAnytimeLogDialog'

describe('Cramble consistency', () => {
  it('makes only the Cramble name open shared settings', () => {
    const render = (profile: 'hana' | 'cramble') => renderToStaticMarkup(<CrambleSettingsContext.Provider value={() => {}}><ProfileTopBar profile={profile} /></CrambleSettingsContext.Provider>)
    expect(render('cramble')).toContain('cramble — open page settings')
    expect(render('hana')).not.toContain('open page settings')
  })
  it('renders exactly one pending-save notice from the shell, not its children', () => {
    const notice = <CloudSyncNotice profile="cramble" status="offline" hasPendingSave saveConfirmedAt={null} onRetry={() => {}} onExportBackup={() => {}} />
    const html = renderToStaticMarkup(<>{notice}<CrambleSharedSyncContext.Provider value>{notice}</CrambleSharedSyncContext.Provider></>)
    expect(html.match(/Saved on this device/g)).toHaveLength(1)
    expect(html).toContain('Retry now')
  })
  it('offers category and Unsorted while editing a habit with existing records', () => {
    const html = renderToStaticMarkup(<AddAnytimeLogDialog profile="cramble" mode="edit" kindLocked categories={{ care: 'Care' }} initialValue={{ title: 'Hair', description: 'Care for hair', kind: 'check', categoryId: 'care' }} existingTitles={[]} onSubmit={() => null} onClose={() => {}} onChooseScheduled={() => {}} />)
    expect(html).toContain('Unsorted')
    expect(html).toContain('<option value="care" selected="">Care</option>')
    expect(html).toContain('Edit habit')
  })
})
