import { ChevronLeft } from 'lucide-react'
import { useContext } from 'react'
import { CrambleSettingsContext } from './CrambleSettings'

type ProfileTopBarProps = {
  profile: 'hana' | 'cramble'
  onBack?: () => void
  onSettings?: () => void
}

export function ProfileTopBar({ profile, onBack, onSettings }: ProfileTopBarProps) {
  const name = profile === 'hana' ? 'hana' : 'cramble'
  const sharedSettings = useContext(CrambleSettingsContext)
  if (profile === 'cramble' && sharedSettings) onSettings = sharedSettings

  return (
    <nav
      className={`profile-top-bar profile-top-bar-${profile}`}
      aria-label={`${name} navigation`}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="profile-top-bar-back"
          aria-label="Back to home"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : (
        <span className="profile-top-bar-spacer" aria-hidden="true" />
      )}
      {onSettings ? <button type="button" className="profile-top-bar-name profile-top-bar-settings" onClick={onSettings} aria-label={`${name} — open page settings`}>{name}</button> : <span className="profile-top-bar-name">{name}</span>}
      <span className="profile-top-bar-spacer" aria-hidden="true" />
    </nav>
  )
}
