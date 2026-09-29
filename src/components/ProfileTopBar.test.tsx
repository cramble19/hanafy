import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProfileTopBar } from './ProfileTopBar'

describe('ProfileTopBar', () => {
  it.each(['hana', 'cramble'] as const)(
    'keeps the %s name centered without a level control',
    (profile) => {
      const html = renderToStaticMarkup(
        <ProfileTopBar profile={profile} onBack={() => undefined} />,
      )

      expect(html).toContain(`profile-top-bar-${profile}`)
      expect(html).toContain(`>${profile}</span>`)
      expect(html).toContain('aria-label="Back to home"')
      expect(html).toContain('profile-top-bar-spacer')
      expect(html).not.toMatch(/level|lv\s*\d/i)
    },
  )

  it('keeps the Cramble name centered without a home action', () => {
    const html = renderToStaticMarkup(<ProfileTopBar profile="cramble" />)

    expect(html).toContain('profile-top-bar-spacer')
    expect(html).not.toContain('aria-label="Back to home"')
  })
})
