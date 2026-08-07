type Props = { className?: string }

const PETAL_ROTATIONS = [0, 72, 144, 216, 288]

/** A compact cherry blossom for Hana's Garden action. */
export function GardenBlossomIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#a86f79" strokeWidth="0.85" strokeLinejoin="round">
        {PETAL_ROTATIONS.map((degrees, index) => (
          <path
            key={degrees}
            d="M16 16 C13.5 13.5 11.2 11 11.6 8.3 C11.9 6 14.1 5.1 15.6 6.9 C15.8 7.2 16.2 7.2 16.4 6.9 C17.9 5.1 20.1 6 20.4 8.3 C20.8 11 18.5 13.5 16 16 Z"
            fill={index % 2 === 0 ? '#f7d4db' : '#f3c4cf'}
            transform={`rotate(${degrees} 16 16)`}
          />
        ))}
      </g>

      <g
        fill="none"
        stroke="#bd7f8d"
        strokeWidth="0.65"
        strokeLinecap="round"
        opacity="0.78"
      >
        {PETAL_ROTATIONS.map((degrees) => (
          <path
            key={degrees}
            d="M16 13.8 C16 11.9 16 10.5 16 9"
            transform={`rotate(${degrees} 16 16)`}
          />
        ))}
      </g>

      <circle
        cx="16"
        cy="16"
        r="3.1"
        fill="#f0c46e"
        stroke="#a86f79"
        strokeWidth="0.85"
      />
      <circle cx="15.15" cy="15.1" r="0.7" fill="#fff3c9" opacity="0.92" />
    </svg>
  )
}
