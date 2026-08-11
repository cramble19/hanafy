import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GardenBlossomIcon } from '@/components/icons/GardenBlossomIcon'
import {
  FLOWERS_BY_DIFFICULTY,
  SPRING_ARC,
  type getLevelProgress,
  type getSpringArcProgress,
} from '@/lib/hanaGame'

type Props = {
  totalFlowers: number
  levelProgress: ReturnType<typeof getLevelProgress>
  springArc: ReturnType<typeof getSpringArcProgress>
  onOpenGarden: () => void
}

const MILESTONES = [
  { level: 1, flowers: 0 },
  { level: 2, flowers: 5 },
  { level: 3, flowers: 12 },
  { level: 4, flowers: 22 },
  { level: 5, flowers: 35 },
] as const

const RING_BLOSSOMS = [
  { level: 1, x: 67, y: 65, scale: 0.78 },
  { level: 2, x: 36, y: 126, scale: 0.9 },
  { level: 3, x: 67, y: 199, scale: 1 },
  { level: 4, x: 137, y: 228, scale: 1.04 },
  { level: 5, x: 211, y: 184, scale: 1.1 },
] as const

export function HanaJourneyCard({
  totalFlowers,
  levelProgress,
  springArc,
  onOpenGarden,
}: Props) {
  const cardRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const safeTotal = Math.max(0, totalFlowers)
  const overallPercent = Math.min(
    100,
    Math.round((safeTotal / SPRING_ARC.targetFlowers) * 100),
  )
  const markerPercent = Math.min(98, Math.max(2, overallPercent))

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold: 0.22 },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  const progressStyle = {
    strokeDashoffset: isVisible ? 100 - overallPercent : 100,
  } satisfies CSSProperties

  return (
    <section
      ref={cardRef}
      className="hana-journey-card mb-8"
      data-visible={isVisible}
      aria-labelledby="hana-journey-title"
    >
      <div className="hana-journey-corner hana-journey-corner-left" aria-hidden="true" />
      <div className="hana-journey-corner hana-journey-corner-right" aria-hidden="true" />

      <header className="hana-journey-heading">
        <p>Spring · Arc {springArc.arcNumber}</p>
        <h2 id="hana-journey-title">Your garden journey</h2>
      </header>

      <div
        className="hana-journey-ring"
        role="progressbar"
        aria-label={`Spring journey: ${safeTotal} of ${springArc.targetFlowers} flowers`}
        aria-valuemin={0}
        aria-valuemax={springArc.targetFlowers}
        aria-valuenow={Math.min(safeTotal, springArc.targetFlowers)}
      >
        <svg viewBox="0 0 260 260" aria-hidden="true">
          <circle className="hana-journey-ring-track" cx="130" cy="130" r="105" pathLength="100" />
          <circle
            className="hana-journey-ring-progress"
            cx="130"
            cy="130"
            r="105"
            pathLength="100"
            style={progressStyle}
          />
          <path
            className="hana-journey-vine"
            d="M128 25 C68 20 25 67 25 128 C25 190 73 235 133 235"
          />
          <g className="hana-journey-leaves">
            <path d="M75 42 C62 35 57 45 70 52 C77 55 82 49 75 42Z" />
            <path d="M50 72 C35 68 35 81 49 85 C57 86 60 78 50 72Z" />
            <path d="M31 112 C18 105 14 118 27 125 C34 128 40 119 31 112Z" />
            <path d="M33 163 C20 169 26 181 39 174 C46 169 42 161 33 163Z" />
            <path d="M57 202 C48 213 59 222 69 210 C73 203 65 197 57 202Z" />
            <path d="M98 228 C94 243 108 244 112 230 C112 221 102 220 98 228Z" />
          </g>
          {RING_BLOSSOMS.map((blossom, index) => (
            <JourneyBlossom
              key={blossom.level}
              {...blossom}
              visible={levelProgress.level >= blossom.level && blossom.level <= 5}
              delay={index * 110}
            />
          ))}
        </svg>

        <span className="hana-journey-percent" aria-hidden="true">
          {overallPercent}%
        </span>
        <span className="hana-journey-ring-copy">
          <strong>Level {levelProgress.level}</strong>
          <span>{safeTotal} flowers</span>
        </span>
        <span className="hana-journey-petals" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>

      <p className="hana-journey-remaining">
        {springArc.isComplete
          ? 'Spring is in full bloom'
          : `${springArc.flowersRemaining} flowers to complete Spring`}
      </p>

      <div className="hana-journey-milestones" aria-label="Spring level milestones">
        <span className="hana-journey-milestone-line" aria-hidden="true">
          <span style={{ width: `${overallPercent}%` }} />
          <i style={{ left: `${markerPercent}%` }} />
        </span>
        {MILESTONES.map((milestone, index) => {
          const reached = safeTotal >= milestone.flowers
          return (
            <span
              key={milestone.level}
              className="hana-journey-milestone"
              data-reached={reached}
              style={{ '--milestone-delay': `${index * 90}ms` } as CSSProperties}
            >
              <span className="hana-journey-milestone-icon" aria-hidden="true">
                <GardenBlossomIcon className="size-full" />
              </span>
              <strong>L{milestone.level}</strong>
              <span>{milestone.flowers}</span>
            </span>
          )
        })}
      </div>

      <button type="button" className="hana-journey-garden-button" onClick={onOpenGarden}>
        <GardenBlossomIcon className="size-6" />
        View garden
      </button>

      <details className="hana-journey-details">
        <summary>How levels work</summary>
        <div>
          <p>
            Completed goal windows earn flowers: easy +{FLOWERS_BY_DIFFICULTY.easy}, medium +
            {FLOWERS_BY_DIFFICULTY.medium}, and hard +{FLOWERS_BY_DIFFICULTY.hard}.
          </p>
          <p>
            {springArc.isComplete
              ? `Spring is complete at Level ${springArc.targetLevel}.`
              : `${levelProgress.collectedThisLevel} of ${levelProgress.neededThisLevel} flowers collected toward Level ${levelProgress.level + 1}.`}
          </p>
          <p>Skipped and paused goals stay neutral. Every three Evening Weeds wilt one flower.</p>
        </div>
      </details>
    </section>
  )
}

function JourneyBlossom({
  x,
  y,
  scale,
  visible,
  delay,
}: {
  x: number
  y: number
  scale: number
  visible: boolean
  delay: number
}) {
  return (
    <g
      className="hana-journey-ring-blossom"
      data-visible={visible}
      style={{ '--blossom-delay': `${delay}ms` } as CSSProperties}
      transform={`translate(${x} ${y}) scale(${scale})`}
    >
      {[0, 72, 144, 216, 288].map((rotation, index) => (
        <ellipse
          key={rotation}
          cx="0"
          cy="-7"
          rx="4.6"
          ry="7.4"
          fill={index % 2 ? '#f3c4cf' : '#f7d4db'}
          stroke="#a86f79"
          strokeWidth="0.85"
          transform={`rotate(${rotation})`}
        />
      ))}
      <circle r="3.2" fill="#f0c46e" stroke="#a86f79" strokeWidth="0.8" />
    </g>
  )
}
