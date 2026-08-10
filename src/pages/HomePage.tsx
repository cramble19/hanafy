import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { SunMark } from '@/components/icons/SunMark'
import { TogetherMark } from '@/components/icons/TogetherMark'
import { EmotionFaceIcon } from '@/components/icons/EmotionFaceIcon'
import { DAILY_EMOTION_LABELS } from '@/lib/dailyEmotions'
import type { DailyEmotion } from '@/types'

type Props = {
  onSelectHana: () => void
  onSelectCramble: () => void
  onSelectTogether: () => void
  focusTarget?: 'hana' | 'cramble' | 'together' | null
  hanaEmotion?: DailyEmotion | null
  crambleEmotion?: DailyEmotion | null
}

export function HomePage({
  onSelectHana,
  onSelectCramble,
  onSelectTogether,
  focusTarget = null,
  hanaEmotion = null,
  crambleEmotion = null,
}: Props) {
  const [showPhoto, setShowPhoto] = useState(false)
  const hanaButtonRef = useRef<HTMLButtonElement>(null)
  const crambleButtonRef = useRef<HTMLButtonElement>(null)
  const togetherButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusTarget === 'hana') {
      hanaButtonRef.current?.focus({ preventScroll: true })
    }
    if (focusTarget === 'cramble') {
      crambleButtonRef.current?.focus({ preventScroll: true })
    }
    if (focusTarget === 'together') {
      togetherButtonRef.current?.focus({ preventScroll: true })
    }
  }, [focusTarget])

  return (
    <div className="home-shell mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <div className="home-orb home-orb-flower" aria-hidden="true" />
      <div className="home-orb home-orb-sun" aria-hidden="true" />

      <header className="mb-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
          A little garden for two
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          <button
            type="button"
            onClick={() => setShowPhoto(true)}
            className="home-whose rounded-control outline-none transition hover:text-muted focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
            aria-label="Open a hidden memory"
          >
            Whose
          </button>{' '}
          day is it?
        </h1>
        <p className="mt-3 text-xs text-faint">tap softly, gardens remember</p>
      </header>

      <div className="relative flex items-start justify-center gap-8">
        <button
          ref={hanaButtonRef}
          type="button"
          onClick={onSelectHana}
          aria-label={`Open Hana's tracker${hanaEmotion ? `. Today's emotion: ${DAILY_EMOTION_LABELS[hanaEmotion]}.` : ''}`}
          className="emblem-btn flex flex-col items-center gap-4 outline-none"
        >
          <span className="emblem-wrap">
            {hanaEmotion ? (
              <EmotionFaceIcon
                emotion={hanaEmotion}
                profile="hana"
                className="home-emotion-status home-emotion-status-hana"
              />
            ) : null}
            <span className="emblem emblem-flower">
              <FlowerMark className="size-20" />
            </span>
          </span>
          <span className="text-lg font-medium text-ink">Hana</span>
        </button>

        <button
          ref={crambleButtonRef}
          type="button"
          onClick={onSelectCramble}
          aria-label={`Open Cramble's tracker${crambleEmotion ? `. Today's emotion: ${DAILY_EMOTION_LABELS[crambleEmotion]}.` : ''}`}
          className="emblem-btn flex flex-col items-center gap-4 outline-none"
        >
          <span className="emblem-wrap is-delayed">
            {crambleEmotion ? (
              <EmotionFaceIcon
                emotion={crambleEmotion}
                profile="cramble"
                className="home-emotion-status home-emotion-status-cramble"
              />
            ) : null}
            <span className="emblem emblem-sun">
              <SunMark className="size-20" />
            </span>
          </span>
          <span className="text-lg font-medium text-ink">Cramble</span>
        </button>
      </div>

      <button
        ref={togetherButtonRef}
        type="button"
        onClick={onSelectTogether}
        aria-label="Open combined stats for Hana and Cramble"
        className="home-together-card mt-10 flex w-full items-center gap-4 rounded-[26px] border border-border bg-surface/90 px-5 py-4 text-left outline-none"
      >
        <TogetherMark className="home-together-mark shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-ink">Together</span>
          <span className="mt-0.5 block text-sm text-muted">
            See your shared rhythm
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden="true" />
      </button>

      <p className="mt-10 text-center text-sm leading-6 text-muted">
        Two separate paths, each with its own progress and story.
      </p>

      {showPhoto ? (
        <div
          className="home-memory-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="A hidden memory"
          onClick={() => setShowPhoto(false)}
        >
          <div
            className="home-memory-card"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src="/couple-watercolor.png"
              alt="A watercolor portrait of us together"
              className="aspect-[4/3] w-full rounded-[22px] object-cover"
            />
            <div className="px-2 pb-2 pt-4 text-center">
              <p className="text-sm font-medium text-ink">
                A little garden for us.
              </p>
              <button
                type="button"
                onClick={() => setShowPhoto(false)}
                className="mt-3 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-muted transition active:scale-95 motion-reduce:transition-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
