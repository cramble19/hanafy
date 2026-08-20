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
      <SunMark className="together-mark-sun" />
    </span>
  )
}
