import { Shuffle } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'
import {
  chooseRandomEmoji,
  getEmojiChoices,
  getEmojiLabel,
  type EmojiChoice,
  type EmojiProfile,
} from '@/lib/emojiLibrary'
import './emoji-picker.css'

type EmojiPickerProps = {
  profile: EmojiProfile
  value: string
  onChange: (emoji: string) => void
  label?: string
  disabled?: boolean
  additionalChoices?: readonly EmojiChoice[]
}

export function nextEmojiChoiceIndex(
  currentIndex: number,
  key: string,
  choiceCount: number,
) {
  if (choiceCount <= 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % choiceCount
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + choiceCount) % choiceCount
  }
  if (key === 'Home') return 0
  if (key === 'End') return choiceCount - 1
  return null
}

export function EmojiPicker({
  profile,
  value,
  onChange,
  label = 'Choose an icon',
  disabled = false,
  additionalChoices = [],
}: EmojiPickerProps) {
  const statusId = useId()
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([])
  const profileChoices = getEmojiChoices(profile)
  const availableChoices = uniqueEmojiChoices([
    ...additionalChoices,
    ...profileChoices,
  ])
  const choices = availableChoices.some((choice) => choice.emoji === value)
    ? availableChoices
    : [{ emoji: value, label: 'Current icon' }, ...availableChoices]
  const selectedLabel =
    choices.find((choice) => choice.emoji === value)?.label ??
    getEmojiLabel(profile, value)
  const selectedIndex = choices.findIndex((choice) => choice.emoji === value)

  const handleChoiceKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const nextIndex = nextEmojiChoiceIndex(
      currentIndex,
      event.key,
      choices.length,
    )
    if (nextIndex === null) return
    event.preventDefault()
    onChange(choices[nextIndex].emoji)
    choiceRefs.current[nextIndex]?.focus()
  }

  return (
    <fieldset
      className={`emoji-picker emoji-picker--${profile}`}
      aria-describedby={statusId}
      disabled={disabled}
    >
      <legend className="emoji-picker__legend">{label}</legend>
      <div className="emoji-picker__top-row">
        <span className="emoji-picker__current" aria-hidden="true">
          {value}
        </span>
        <span className="emoji-picker__current-name">{selectedLabel}</span>
        <button
          type="button"
          className="emoji-picker__randomize"
          onClick={() => onChange(chooseRandomEmoji(profile, value))}
          aria-label={`Surprise me with another icon. Current icon: ${selectedLabel}`}
        >
          <Shuffle aria-hidden="true" />
          <span>Surprise me</span>
        </button>
      </div>
      <div className="emoji-picker__grid" role="radiogroup" aria-label={label}>
        {choices.map((choice, index) => (
          <button
            key={choice.emoji}
            ref={(element) => {
              choiceRefs.current[index] = element
            }}
            type="button"
            role="radio"
            className="emoji-picker__choice"
            aria-label={`${choice.label}: ${choice.emoji}`}
            aria-checked={choice.emoji === value}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(choice.emoji)}
            onKeyDown={(event) => handleChoiceKeyDown(event, index)}
          >
            <span aria-hidden="true">{choice.emoji}</span>
          </button>
        ))}
      </div>
      <span id={statusId} className="sr-only" aria-live="polite">
        {selectedLabel} selected.
      </span>
    </fieldset>
  )
}

function uniqueEmojiChoices(choices: readonly EmojiChoice[]) {
  const seen = new Set<string>()
  return choices.filter((choice) => {
    if (seen.has(choice.emoji)) return false
    seen.add(choice.emoji)
    return true
  })
}
