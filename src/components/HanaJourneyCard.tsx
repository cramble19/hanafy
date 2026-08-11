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
        </svg>

        <span className="hana-journey-percent" aria-hidden="true">
          {overallPercent}%
        </span>
        <span className="hana-journey-ring-copy">
          <strong>Level {levelProgress.level}</strong>
          <span>{safeTotal} flowers</span>
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
