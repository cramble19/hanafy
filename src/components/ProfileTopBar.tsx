import { ChevronLeft, Settings2 } from 'lucide-react'

type ProfileTopBarProps = {
  profile: 'hana' | 'cramble'
  onBack?: () => void
  onSettings?: () => void
}

export function ProfileTopBar({ profile, onBack, onSettings }: ProfileTopBarProps) {
  const name = profile === 'hana' ? 'hana' : 'cramble'

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
      <span className="profile-top-bar-name">{name}</span>
      {onSettings ? <button type="button" className="profile-top-bar-back" onClick={onSettings} aria-label="Open Someday category settings"><Settings2 aria-hidden="true" /></button> : <span className="profile-top-bar-spacer" aria-hidden="true" />}
    </nav>
  )
}
