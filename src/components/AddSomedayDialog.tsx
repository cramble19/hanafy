import { Hourglass, Infinity, Plus, X } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  getNewSomedayItemValidationError,
  SOMEDAY_LIMITS,
} from '@/lib/someday'
import type { NewSomedayItemInput, SomedayItem } from '@/types'

type Props = {
  profile: 'hana' | 'cramble'
  existingItems: SomedayItem[]
  onClose: () => void
  onSubmit: (input: NewSomedayItemInput) => string | null
}

export function AddSomedayDialog({
  profile,
  existingItems,
  onClose,
  onSubmit,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const headingId = useId()
  const descriptionId = useId()
  const [title, setTitle] = useState('')
  const [timing, setTiming] = useState<NewSomedayItemInput['timing']>('timeless')
  const [age, setAge] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    window.setTimeout(() => titleRef.current?.focus(), 0)
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input: NewSomedayItemInput = {
      title: title.trim(),
      timing,
      targetAge: timing === 'beforeAge' ? Number(age) : null,
    }
    const validationError = getNewSomedayItemValidationError(input, existingItems)
    if (validationError) {
      setError(validationError)
      if (!title.trim()) titleRef.current?.focus()
      else if (timing === 'beforeAge') ageRef.current?.focus()
      return
    }
    const submitError = onSubmit(input)
    if (submitError) {
      setError(submitError)
      return
    }
    close()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`someday-dialog someday-dialog-${profile}`}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close()
      }}
    >
      <form className="someday-dialog-panel" onSubmit={submit}>
        <div className="someday-dialog-heading">
          <div>
            <p className="someday-dialog-eyebrow">A new possibility</p>
            <h2 id={headingId}>Add something</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close Someday form">
            <X aria-hidden="true" />
          </button>
        </div>
        <p id={descriptionId} className="someday-dialog-intro">
          Keep it timeless, or give it an age that matters to you.
        </p>

        <label className="someday-field">
          <span>What would you like to do?</span>
          <input
            ref={titleRef}
            value={title}
            maxLength={SOMEDAY_LIMITS.title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError(null)
            }}
            placeholder="See cherry blossoms in Japan"
            autoComplete="off"
          />
        </label>

        <fieldset className="someday-timing-fieldset">
          <legend>When?</legend>
          <div className="someday-timing-options">
            <button
              type="button"
              data-selected={timing === 'timeless'}
              onClick={() => {
                setTiming('timeless')
                setError(null)
              }}
            >
              <Infinity aria-hidden="true" />
              <span><strong>Anytime</strong><small>No deadline</small></span>
            </button>
            <button
              type="button"
              data-selected={timing === 'beforeAge'}
              onClick={() => {
                setTiming('beforeAge')
                setError(null)
                window.setTimeout(() => ageRef.current?.focus(), 0)
              }}
            >
              <Hourglass aria-hidden="true" />
              <span><strong>Before an age</strong><small>You choose the age</small></span>
            </button>
          </div>
        </fieldset>

        {timing === 'beforeAge' ? (
          <label className="someday-field someday-age-field">
            <span>Complete before age</span>
            <input
              ref={ageRef}
              type="number"
              inputMode="numeric"
              min={SOMEDAY_LIMITS.minimumAge}
              max={SOMEDAY_LIMITS.maximumAge}
              value={age}
              onChange={(event) => {
                setAge(event.target.value)
                setError(null)
              }}
              placeholder="35"
            />
          </label>
        ) : null}

        {error ? <p className="someday-dialog-error" role="alert">{error}</p> : null}
        <button type="submit" className="someday-submit-button">
          <Plus aria-hidden="true" />
          Add to Someday
        </button>
      </form>
    </dialog>
  )
}
