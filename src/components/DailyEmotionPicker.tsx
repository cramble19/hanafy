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
  return (
    <div
      className={`daily-emotion-picker daily-emotion-picker-${profile}`}
      role="group"
      aria-label="Today's emotion"
    >
      {DAILY_EMOTIONS.map((emotion) => (
        <button
          key={emotion}
          type="button"
          className="daily-emotion-option"
          data-selected={value === emotion}
          aria-pressed={value === emotion}
          aria-label={`${DAILY_EMOTION_LABELS[emotion]}${value === emotion ? ', selected' : ''}`}
          disabled={disabled}
          onClick={() => onChange(emotion)}
        >
          <EmotionFaceIcon
            emotion={emotion}
            profile={profile}
            className="daily-emotion-option-icon"
          />
        </button>
      ))}
    </div>
  )
}
