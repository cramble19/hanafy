import { ChevronLeft } from 'lucide-react'

type ProfileTopBarProps = {
  profile: 'hana' | 'cramble'
  onBack: () => void
}

export function ProfileTopBar({ profile, onBack }: ProfileTopBarProps) {
  const name = profile === 'hana' ? 'hana' : 'cramble'

  return (
    <nav
      className={`profile-top-bar profile-top-bar-${profile}`}
      aria-label={`${name} navigation`}
    >
      <button
        type="button"
        onClick={onBack}
        className="profile-top-bar-back"
        aria-label="Back to home"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <span className="profile-top-bar-name">{name}</span>
      <span className="profile-top-bar-spacer" aria-hidden="true" />
    </nav>
  )
}
