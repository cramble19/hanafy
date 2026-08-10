import type { DailyEmotion } from '@/types'

type Props = {
  emotion: DailyEmotion
  profile: 'hana' | 'cramble'
  className?: string
}

export function EmotionFaceIcon({ emotion, profile, className }: Props) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      data-profile={profile}
      data-emotion={emotion}
      aria-hidden="true"
    >
      {profile === 'hana' ? <HanaOrnament /> : <CrambleOrnament />}
      <circle cx="20" cy="20" r="12.5" className="emotion-face-ring" />
      <EmotionExpression emotion={emotion} />
    </svg>
  )
}

function HanaOrnament() {
  return (
    <g className="emotion-face-ornament">
      <path d="M20 6.2c-2.8-2.4-5.3-1.9-6.5.2 2.6.1 4.5 1.1 6.5 3.2 2-2.1 3.9-3.1 6.5-3.2-1.2-2.1-3.7-2.6-6.5-.2Z" />
      <path d="M7.8 24.6c-2.7.2-4.2 1.7-4.2 4.2 2.6.1 4.2-1.3 4.9-3.6M32.2 24.6c2.7.2 4.2 1.7 4.2 4.2-2.6.1-4.2-1.3-4.9-3.6" />
    </g>
  )
}

function CrambleOrnament() {
  return (
    <g className="emotion-face-ornament">
      <path d="m20 2.8 2.2 3.3L20 9.4l-2.2-3.3L20 2.8ZM37.2 20l-3.3 2.2-3.3-2.2 3.3-2.2 3.3 2.2ZM20 37.2l-2.2-3.3 2.2-3.3 2.2 3.3-2.2 3.3ZM2.8 20l3.3-2.2 3.3 2.2-3.3 2.2L2.8 20Z" />
      <circle cx="20" cy="20" r="16" />
    </g>
  )
}

function EmotionExpression({ emotion }: { emotion: DailyEmotion }) {
  if (emotion === 'heavy') {
    return (
      <g className="emotion-face-expression">
        <path d="m13.2 16.4 4 1.1M26.8 16.4l-4 1.1" />
        <path d="M15.5 27c2.8-2.6 6.2-2.6 9 0" />
        <path d="M28.1 20.2c1.5 1.8 1.4 3.4-.2 4.2-1.6-.8-1.7-2.4.2-4.2Z" className="emotion-face-fill" />
      </g>
    )
  }
  if (emotion === 'low') {
    return (
      <g className="emotion-face-expression">
        <path d="M13.4 17.4c1.2 1.1 2.4 1.1 3.6 0M23 17.4c1.2 1.1 2.4 1.1 3.6 0" />
        <path d="M16.2 26c2.4-1.8 5.2-1.8 7.6 0" />
      </g>
    )
  }
  if (emotion === 'okay') {
    return (
      <g className="emotion-face-expression">
        <circle cx="15.3" cy="17.8" r="1" className="emotion-face-fill" />
        <circle cx="24.7" cy="17.8" r="1" className="emotion-face-fill" />
        <path d="M16.6 25h6.8" />
      </g>
    )
  }
  if (emotion === 'good') {
    return (
      <g className="emotion-face-expression">
        <path d="M13.3 18.2c1.3-1.6 2.7-1.6 4 0M22.7 18.2c1.3-1.6 2.7-1.6 4 0" />
        <path d="M15.2 23.6c2.7 3.2 6.9 3.2 9.6 0" />
      </g>
    )
  }
  return (
    <g className="emotion-face-expression">
      <path d="M13.2 17.8c1.3-1.8 2.8-1.8 4.2 0M22.6 17.8c1.4-1.8 2.9-1.8 4.2 0" />
      <path d="M14.8 23.2c2.5 4.1 7.9 4.1 10.4 0" />
      <path d="M17.4 24.7h5.2" />
    </g>
  )
}
