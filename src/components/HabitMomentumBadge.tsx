import type { HanaProfileId } from '@/lib/hanaCloudSync'
import type { HabitMomentumSignal } from '@/lib/hanaStats'

type Props = {
  signal: HabitMomentumSignal | null
  profile: HanaProfileId
  compact?: boolean
}

export function HabitMomentumBadge({
  signal,
  profile,
  compact = false,
}: Props) {
  if (!signal) return null

  return (
    <span
      className="habit-momentum-badge"
      data-kind={signal.kind}
      data-profile={profile}
      data-compact={compact}
      aria-label={signal.ariaLabel}
      title={signal.ariaLabel}
    >
      <span className="habit-momentum-emoji" aria-hidden="true">
        {signal.emoji}
      </span>
      <span>{signal.label}</span>
    </span>
  )
}
