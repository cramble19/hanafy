type Props = { className?: string }

const PETALS = [0, 60, 120, 180, 240, 300]

/** Hana's mark: a simple daisy — rose petals around a sunflower-gold center. */
export function FlowerMark({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {PETALS.map((deg) => (
        <ellipse
          key={deg}
          cx="50"
          cy="27"
          rx="12.5"
          ry="20"
          fill="#d98ba0"
          fillOpacity="0.92"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="12.5" fill="#eea63a" />
    </svg>
  )
}
