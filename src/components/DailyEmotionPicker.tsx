import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { DailyEmotion } from '@/types'
import {
  DAILY_EMOTIONS,
  DAILY_EMOTION_LABELS,
} from '@/lib/dailyEmotions'
import { EmotionFaceIcon } from '@/components/icons/EmotionFaceIcon'

type Props = {
  profile: 'hana' | 'cramble'
  value: DailyEmotion | null
  disabled?: boolean
  onChange: (emotion: DailyEmotion) => void
}

export function DailyEmotionPicker({
  profile,
  value,
  disabled = false,
  onChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const selectedLabel = value ? DAILY_EMOTION_LABELS[value] : 'Choose'

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      triggerRef.current?.focus()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div
      ref={rootRef}
      className={`daily-emotion-picker daily-emotion-picker-${profile}`}
    >
      <span className="daily-emotion-question">How was today?</span>
      <button
        ref={triggerRef}
        type="button"
        className="daily-emotion-trigger"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={`${value ? `Today's emotion is ${selectedLabel}.` : 'Choose today\'s emotion.'} Open emotion picker`}
      >
        {value ? (
          <EmotionFaceIcon
            emotion={value}
            profile={profile}
            className="daily-emotion-trigger-icon"
          />
        ) : null}
        <span>{disabled ? 'Paused' : selectedLabel}</span>
        <ChevronDown className="daily-emotion-chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <section
          id={panelId}
          role="dialog"
          aria-label="Choose today's feeling"
          className="daily-emotion-popover"
        >
          <div className="daily-emotion-options">
            {DAILY_EMOTIONS.map((emotion) => (
              <button
                key={emotion}
                type="button"
                className="daily-emotion-option"
                data-selected={value === emotion}
                aria-pressed={value === emotion}
                onClick={() => {
                  onChange(emotion)
                  setIsOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                <EmotionFaceIcon
                  emotion={emotion}
                  profile={profile}
                  className="daily-emotion-option-icon"
                />
                <span>{DAILY_EMOTION_LABELS[emotion]}</span>
              </button>
            ))}
          </div>
          <p>Empty days stay neutral.</p>
        </section>
      ) : null}
    </div>
  )
}
