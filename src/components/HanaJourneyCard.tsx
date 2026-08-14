import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
}

export function HanaJourneyCard({
  totalFlowers,
  levelProgress,
  springArc,
}: Props) {
  const cardRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const safeTotal = Math.max(0, totalFlowers)
  const overallPercent = Math.min(
    100,
    Math.round((safeTotal / SPRING_ARC.targetFlowers) * 100),
  )
  const flowersToNextLevel = Math.max(
    0,
    levelProgress.neededThisLevel - levelProgress.collectedThisLevel,
  )

  useEffect(() => {
    const card = cardRef.current
    if (!card || !('IntersectionObserver' in window)) {
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
    width: isVisible ? `${overallPercent}%` : '0%',
  } satisfies CSSProperties

  return (
    <section
      ref={cardRef}
      className="hana-journey-card"
      data-visible={isVisible}
      aria-labelledby="hana-journey-title"
    >
      <header className="hana-journey-heading">
        <div>
          <p>Your journey</p>
          <h2 id="hana-journey-title">
            Level {levelProgress.level} ·{' '}
            {springArc.isComplete ? 'In full bloom' : 'Growing rhythm'}
          </h2>
        </div>
        <strong className="hana-journey-percent" aria-hidden="true">
          {overallPercent}%
        </strong>
      </header>

      <div
        className="hana-journey-track"
        role="progressbar"
        aria-label={`Spring journey: ${safeTotal} of ${springArc.targetFlowers} flowers`}
        aria-valuemin={0}
        aria-valuemax={springArc.targetFlowers}
        aria-valuenow={Math.min(safeTotal, springArc.targetFlowers)}
      >
        <span style={progressStyle} />
      </div>

      <div className="hana-journey-summary">
        <span>{safeTotal} flowers gathered</span>
        <span>
          {springArc.isComplete
            ? 'Spring is complete'
            : `${flowersToNextLevel} more to Level ${levelProgress.level + 1}`}
        </span>
      </div>

      <details className="hana-journey-details">
        <summary>How levels work</summary>
        <div>
          <p>
            Completed goal windows earn flowers: easy +
            {FLOWERS_BY_DIFFICULTY.easy}, medium +
            {FLOWERS_BY_DIFFICULTY.medium}, and hard +
            {FLOWERS_BY_DIFFICULTY.hard}.
          </p>
          <p>
            Skipped and paused goals stay neutral. Every three Evening Weeds
            wilt one flower.
          </p>
        </div>
      </details>
    </section>
  )
}
