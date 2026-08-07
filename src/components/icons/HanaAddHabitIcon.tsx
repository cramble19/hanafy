type Props = { className?: string }

/** Hana's add action: a clear plus paired with a new blossom bud. */
export function HanaAddHabitIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="#fffaf3"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M5.5 10.5 H15.5" />
        <path d="M10.5 5.5 V15.5" />
      </g>

      <path
        d="M14.2 27 C15.1 23.7 17.3 21.1 20.2 19"
        fill="none"
        stroke="#dce8d5"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M15.8 23.7 C13.2 23.6 11.7 22.2 11.9 20.3 C14.2 19.9 16.2 20.8 17.3 22.5 Z"
        fill="#b8caa8"
        stroke="#fffaf3"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
      <path
        d="M18.7 20.5 C17.3 18.6 17.7 16.4 19.6 14.8 C20.2 14.3 20.8 13.9 21.5 13.6 C22 14.1 22.4 14.7 22.7 15.4 C23.8 17.7 22.8 19.8 20.6 20.9 Z"
        fill="#f5cbd5"
        stroke="#fffaf3"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M20.2 19.2 C20.6 17.5 21 16.3 21.5 15.2"
        fill="none"
        stroke="#b87381"
        strokeWidth="0.65"
        strokeLinecap="round"
      />
      <circle
        cx="20.1"
        cy="20.3"
        r="1.25"
        fill="#efc36d"
        stroke="#fffaf3"
        strokeWidth="0.6"
      />
    </svg>
  )
}
