import { FlowerMark } from './FlowerMark'
import { SunMark } from './SunMark'

type Props = { className?: string }

/** Hana and Cramble's marks joined without replacing either profile identity. */
export function TogetherMark({ className = '' }: Props) {
  return (
    <span
      className={`together-mark ${className}`.trim()}
      aria-hidden="true"
    >
      <FlowerMark className="together-mark-flower" />
      <svg
        className="together-mark-vine"
        viewBox="0 0 52 24"
        focusable="false"
      >
        <path
          d="M2 8c10 0 12 11 24 11 9 0 13-7 24-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M22 17c-1.4-5.1 1.2-8.4 5.7-8.7-.2 4.8-2.2 7.8-5.7 8.7Z"
          fill="#aeb983"
          stroke="#73805a"
          strokeWidth="0.8"
        />
      </svg>
      <SunMark className="together-mark-sun" />
    </span>
  )
}
