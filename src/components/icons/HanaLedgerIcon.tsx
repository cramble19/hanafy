type Props = { className?: string }

const PETAL_ROTATIONS = [0, 72, 144, 216, 288]

/** Hana's ledger action: an open record book finished with a blossom seal. */
export function HanaLedgerIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 7.4 C8 6.1 12.4 6.8 16 9.2 V25.6 C12.5 23.4 8.2 22.9 3.5 24.3 Z"
        fill="#fffaf3"
        stroke="#667b57"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M28.5 7.4 C24 6.1 19.6 6.8 16 9.2 V25.6 C19.5 23.4 23.8 22.9 28.5 24.3 Z"
        fill="#fffaf3"
        stroke="#667b57"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.2 V25.6"
        fill="none"
        stroke="#667b57"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <g
        fill="none"
        stroke="#8a9a76"
        strokeWidth="0.9"
        strokeLinecap="round"
      >
        <path d="M6.7 11.2 C9.1 10.8 11.2 11.1 13.1 12" />
        <path d="M6.7 14.5 C9.1 14.1 11.2 14.4 13.1 15.3" />
        <path d="M18.9 12 C20.8 11.1 22.9 10.8 25.3 11.2" />
        <path d="M18.9 15.3 C20.8 14.4 22.9 14.1 25.3 14.5" />
      </g>

      <g transform="translate(22.1 19.6) scale(0.34) translate(-16 -16)">
        <g stroke="#a86f79" strokeWidth="1.15" strokeLinejoin="round">
          {PETAL_ROTATIONS.map((degrees, index) => (
            <path
              key={degrees}
              d="M16 16 C13.5 13.5 11.2 11 11.6 8.3 C11.9 6 14.1 5.1 15.6 6.9 C15.8 7.2 16.2 7.2 16.4 6.9 C17.9 5.1 20.1 6 20.4 8.3 C20.8 11 18.5 13.5 16 16 Z"
              fill={index % 2 === 0 ? '#f7d4db' : '#f3c4cf'}
              transform={`rotate(${degrees} 16 16)`}
            />
          ))}
        </g>
        <circle
          cx="16"
          cy="16"
          r="3.2"
          fill="#f0c46e"
          stroke="#a86f79"
          strokeWidth="1.05"
        />
      </g>
    </svg>
  )
}
