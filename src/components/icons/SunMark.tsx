type Props = { className?: string }

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** Your mark: a warm sun with slowly-turning rays (rays animated via .sun-rays). */
export function SunMark({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g className="sun-rays">
        {RAYS.map((deg) => (
          <rect
            key={deg}
            x="47.5"
            y="5"
            width="5"
            height="16"
            rx="2.5"
            fill="#eea63a"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="23" fill="#f2b84b" />
    </svg>
  )
}
