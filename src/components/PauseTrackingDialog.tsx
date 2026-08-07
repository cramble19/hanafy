import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { HeartPulse, Pause, X } from 'lucide-react'
import { addDays } from '@/lib/hanaGame'
import {
  PAUSE_REASON_OPTIONS,
  type PauseInput,
} from '@/lib/habitLifecycle'
import type { PauseReason } from '@/types'

type PauseDuration = 'today' | 'threeDays' | 'week' | 'custom' | 'indefinite'

type Props = {
  profile: 'hana' | 'cramble'
  currentDate: string
  habitTitle?: string
  onClose: () => void
  onSubmit: (input: PauseInput) => void
}

export function PauseTrackingDialog({
  profile,
  currentDate,
  habitTitle,
  onClose,
  onSubmit,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [duration, setDuration] = useState<PauseDuration>('today')
  const [customEndDate, setCustomEndDate] = useState(addDays(currentDate, 1))
  const [reason, setReason] = useState<PauseReason | ''>('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!reason) return
    onSubmit({
      reason,
      endDate: resolveEndDate(duration, currentDate, customEndDate),
    })
    close()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`add-habit-dialog add-habit-dialog-${profile}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <form
        onSubmit={submit}
        className="add-habit-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="add-habit-heading-icon" aria-hidden="true">
              <HeartPulse className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                Neutral time
              </p>
              <h2 id={titleId} className="mt-0.5 text-2xl font-semibold text-ink">
                Pause {habitTitle ? habitTitle : 'tracking'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close pause tracking"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          Nothing becomes unfinished while paused. Existing progress stays,
          reminders stop, and returning creates no backlog.
        </p>

        <fieldset className="mt-5">
          <legend className="add-habit-label">How long?</legend>
          <div className="pause-choice-grid mt-2">
            {(
              [
                ['today', 'Today only'],
                ['threeDays', '3 days'],
                ['week', '1 week'],
                ['custom', 'Choose date'],
                ['indefinite', 'Until I resume'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="pause-choice" data-selected={duration === value}>
                <input
                  type="radio"
                  name="pause-duration"
                  value={value}
                  checked={duration === value}
                  onChange={() => setDuration(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {duration === 'custom' ? (
            <label className="mt-3 block">
              <span className="add-habit-label">Last paused day</span>
              <input
                type="date"
                min={currentDate}
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="add-habit-input"
                required
              />
            </label>
          ) : null}
        </fieldset>

        <fieldset className="mt-5">
          <legend className="add-habit-label">Reason</legend>
          <div className="pause-reason-grid mt-2 grid grid-cols-2 gap-2">
            {PAUSE_REASON_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="pause-reason-choice"
                data-selected={reason === option.value}
              >
                <input
                  type="radio"
                  name="pause-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  required
                />
                <span className="font-semibold text-ink">{option.label}</span>
                <span className="text-xs leading-5 text-faint">{option.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
          <button type="button" onClick={close} className="min-h-11 rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted">
            Cancel
          </button>
          <button type="submit" className="add-habit-submit">
            <Pause className="size-4" aria-hidden="true" />
            Pause tracking
          </button>
        </div>
      </form>
    </dialog>
  )
}

function resolveEndDate(
  duration: PauseDuration,
  currentDate: string,
  customEndDate: string,
) {
  if (duration === 'today') return currentDate
  if (duration === 'threeDays') return addDays(currentDate, 2)
  if (duration === 'week') return addDays(currentDate, 6)
  if (duration === 'custom') return customEndDate
  return null
}
