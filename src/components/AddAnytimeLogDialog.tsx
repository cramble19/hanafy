import {
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Hash,
  Pause,
  Plus,
  Save,
  Sprout,
  Trash2,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  getNewOpenActivityValidationError,
  OPEN_ACTIVITY_LIMITS,
} from '@/lib/openActivities'
import { resolveInitialEmoji } from '@/lib/emojiLibrary'
import type {
  NewOpenActivityInput,
  CreatableOpenActivityKind,
} from '@/types'
import type { AnytimeLogProfile } from './AnytimeLogSection'
import { EmojiPicker } from './emoji-picker/EmojiPicker'

type ErrorField = 'title' | 'description' | 'unit' | 'form'

export type AddAnytimeLogDialogProps = {
  profile: AnytimeLogProfile
  existingTitles: string[]
  onClose: () => void
  /** Replaces this dialog with the existing scheduled-habit dialog. */
  onChooseScheduled: () => void
  onSubmit: (input: NewOpenActivityInput) => string | null
  mode?: 'create' | 'edit'
  initialValue?: NewOpenActivityInput
  /** Open directly on the approved form, rather than its two-choice entry screen. */
  initialView?: 'chooser' | 'anytime'
  /** Lock the meaning and unit after the first record so history remains truthful. */
  kindLocked?: boolean
  lifecycleStatus?: 'active' | 'paused' | 'archived'
  onRequestPause?: () => void
  onResume?: () => void
  onArchive?: () => void
  onRestore?: () => void
  onDelete?: () => void
}

export function AddAnytimeLogDialog({
  profile,
  existingTitles,
  onClose,
  onChooseScheduled,
  onSubmit,
  mode = 'create',
  initialValue,
  initialView = 'chooser',
  kindLocked = false,
  lifecycleStatus = 'active',
  onRequestPause,
  onResume,
  onArchive,
  onRestore,
  onDelete,
}: AddAnytimeLogDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const unitInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const [showForm, setShowForm] = useState(
    mode === 'edit' || initialView === 'anytime',
  )
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [description, setDescription] = useState(
    initialValue?.description ?? '',
  )
  const [emoji, setEmoji] = useState(
    () => resolveInitialEmoji(profile, initialValue?.emoji),
  )
  const [kind, setKind] = useState<CreatableOpenActivityKind>(
    initialValue?.kind ?? 'check',
  )
  const [unit, setUnit] = useState(initialValue?.unit ?? '')
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<ErrorField | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousBodyOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousBodyOverflow
      if (
        opener?.isConnected &&
        !(opener instanceof HTMLButtonElement && opener.disabled)
      ) {
        opener.focus()
      }
    }
  }, [])

  const clearError = () => {
    setError(null)
    setErrorField(null)
  }

  const closeDialog = () => {
    dialogRef.current?.close()
    onClose()
  }

  const switchToScheduled = () => {
    dialogRef.current?.close()
    onClose()
    onChooseScheduled()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input: NewOpenActivityInput = {
      title: title.trim(),
      description: description.trim(),
      emoji,
      kind,
      unit: kind === 'count' ? unit.trim() || null : null,
    }
    const validation = validateOpenActivity(input, existingTitles)
    if (validation) {
      setError(validation.message)
      setErrorField(validation.field)
      if (validation.field === 'title') titleInputRef.current?.focus()
      if (validation.field === 'description') {
        descriptionInputRef.current?.focus()
      }
      if (validation.field === 'unit') unitInputRef.current?.focus()
      return
    }

    const submitError = onSubmit(input)
    if (submitError) {
      setError(submitError)
      setErrorField('form')
      return
    }
    closeDialog()
  }

  const isEdit = mode === 'edit'
  const heading = isEdit
    ? 'Manage anytime log'
    : profile === 'hana'
      ? 'Add a habit'
      : 'Add to tracker'

  return (
    <dialog
      ref={dialogRef}
      className={`add-habit-dialog add-habit-dialog-${profile} anytime-log-dialog`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        closeDialog()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <form
        noValidate
        onSubmit={submit}
        className="add-habit-panel anytime-log-dialog-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="anytime-dialog-handle" aria-hidden="true" />
        <div className="anytime-dialog-heading-row">
          <span className="add-habit-heading-icon" aria-hidden="true">
            {profile === 'hana' ? <Sprout /> : <BookOpen />}
          </span>
          <div className="min-w-0 flex-1">
            {isEdit ? (
              <p className="anytime-dialog-eyebrow">
                {profile === 'hana' ? 'Tend this record' : 'Revise this field note'}
              </p>
            ) : null}
            <h2 id={titleId}>{heading}</h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label={isEdit ? 'Close manage anytime log' : 'Close add to tracker'}
            className="anytime-dialog-close"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {!isEdit ? (
          <fieldset className="anytime-tracker-kind" aria-describedby={descriptionId}>
            <legend className="sr-only">What would you like to add?</legend>
            <button
              type="button"
              className="anytime-tracker-choice"
              onClick={switchToScheduled}
              autoFocus={!showForm}
            >
              <span className="anytime-tracker-choice-icon" aria-hidden="true">
                <CalendarDays />
              </span>
              <span className="anytime-tracker-choice-title">Scheduled habit</span>
              <span className="anytime-tracker-choice-copy">
                {profile === 'hana'
                  ? 'Has a time or day you aim for.'
                  : 'Track it on a set schedule.'}
              </span>
            </button>
            <button
              type="button"
              className={`anytime-tracker-choice ${showForm ? 'is-selected' : ''}`}
              onClick={() => {
                setShowForm(true)
                clearError()
              }}
              aria-pressed={showForm}
            >
              {showForm ? (
                <span className="anytime-tracker-selected" aria-hidden="true">
                  <Check />
                </span>
              ) : null}
              <span className="anytime-tracker-choice-icon" aria-hidden="true">
                {profile === 'hana' ? <Sprout /> : <BookOpen />}
              </span>
              <span className="anytime-tracker-choice-title">Anytime log</span>
              <span className="anytime-tracker-choice-copy">
                Record it whenever it happens.
              </span>
            </button>
          </fieldset>
        ) : null}

        <p id={descriptionId} className="anytime-dialog-intro">
          {isEdit
            ? 'Update its wording without losing any days already recorded.'
            : showForm
              ? 'Record it whenever it happens. No deadline, streak debt, or missed days.'
              : 'Choose a scheduled habit for something due, or an anytime log for something worth recording whenever it happens.'}
        </p>

        {showForm ? (
          <>
            <div className="anytime-dialog-fields">
              <EmojiPicker
                profile={profile}
                value={emoji}
                onChange={setEmoji}
                label="Log icon"
              />

              <fieldset>
                <legend className="add-habit-label">Record as</legend>
                <div className="anytime-record-kind-grid">
                  <button
                    type="button"
                    aria-pressed={kind === 'check'}
                    disabled={kindLocked}
                    onClick={() => {
                      setKind('check')
                      clearError()
                    }}
                    className="anytime-record-kind"
                  >
                    <span className="anytime-record-kind-icon" aria-hidden="true">
                      <CheckCircle2 />
                    </span>
                    <span>
                      <strong>
                        {profile === 'hana' ? 'Done today' : 'Once today'}
                      </strong>
                      <small>One mark per tracker day</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={kind === 'count'}
                    disabled={kindLocked}
                    onClick={() => {
                      setKind('count')
                      clearError()
                    }}
                    className="anytime-record-kind"
                  >
                    <span className="anytime-record-kind-icon" aria-hidden="true">
                      <Hash />
                    </span>
                    <span>
                      <strong>{profile === 'hana' ? 'Number' : 'Count'}</strong>
                      <small>Track a quantity</small>
                    </span>
                  </button>
                </div>
                {kindLocked ? (
                  <p className="anytime-kind-locked-note">
                    Record type and unit stay fixed after the first log so its
                    earlier history keeps the same meaning.
                  </p>
                ) : null}
              </fieldset>

              <label className="block">
                <span className="add-habit-label">
                  {profile === 'hana' ? 'Habit name' : 'Activity name'}
                </span>
                <input
                  ref={titleInputRef}
                  name="anytime-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    clearError()
                  }}
                  maxLength={OPEN_ACTIVITY_LIMITS.title}
                  autoFocus
                  required
                  aria-invalid={errorField === 'title'}
                  aria-describedby={errorField === 'title' ? errorId : undefined}
                  className="add-habit-input"
                  placeholder={kind === 'check' ? 'Gym visit' : 'Pages read'}
                />
              </label>

              <label className="block">
                <span className="add-habit-label">
                  {profile === 'hana'
                    ? 'What will you record?'
                    : 'What counts as one log?'}
                </span>
                <textarea
                  ref={descriptionInputRef}
                  name="anytime-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    clearError()
                  }}
                  maxLength={OPEN_ACTIVITY_LIMITS.description}
                  rows={3}
                  required
                  aria-invalid={errorField === 'description'}
                  aria-describedby={errorField === 'description' ? errorId : undefined}
                  className="add-habit-input resize-none"
                  placeholder={
                    kind === 'check'
                      ? 'Any movement session counts.'
                      : 'The amount completed today.'
                  }
                />
              </label>

              {kind === 'count' ? (
                <label className="block">
                  <span className="add-habit-label">
                    Unit{' '}
                    <span className="font-normal normal-case tracking-normal text-faint">
                      (optional)
                    </span>
                  </span>
                  <input
                    ref={unitInputRef}
                    name="anytime-unit"
                    value={unit}
                    onChange={(event) => {
                      setUnit(event.target.value)
                      clearError()
                    }}
                    disabled={kindLocked}
                    maxLength={OPEN_ACTIVITY_LIMITS.unit}
                    aria-invalid={errorField === 'unit'}
                    aria-describedby={errorField === 'unit' ? errorId : undefined}
                    className="add-habit-input"
                    placeholder="pages"
                  />
                </label>
              ) : null}
            </div>

            <div className="anytime-neutral-note" role="note">
              <span aria-hidden="true">{profile === 'hana' ? '❧' : 'ⓘ'}</span>
              <span>
                No missed days, streak pressure, or rewards. Empty days stay
                neutral.
              </span>
            </div>

            {isEdit ? (
              <section className="anytime-lifecycle" aria-label="Anytime log lifecycle">
                <p className="add-habit-label">Tracking controls</p>
                <div className="anytime-lifecycle-grid">
                  {lifecycleStatus === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onResume?.()
                        closeDialog()
                      }}
                      className="habit-lifecycle-button"
                    >
                      <Plus aria-hidden="true" /> Resume
                    </button>
                  ) : lifecycleStatus === 'active' ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeDialog()
                        onRequestPause?.()
                      }}
                      className="habit-lifecycle-button"
                    >
                      <Pause aria-hidden="true" /> Pause
                    </button>
                  ) : null}
                  {lifecycleStatus === 'archived' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRestore?.()
                        closeDialog()
                      }}
                      className="habit-lifecycle-button"
                    >
                      <Plus aria-hidden="true" /> Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Archive this anytime log? Its history stays in the Ledger, but it will stop appearing on Today.',
                          )
                        ) {
                          onArchive?.()
                          closeDialog()
                        }
                      }}
                      className="habit-lifecycle-button"
                    >
                      <Archive aria-hidden="true" /> Archive
                    </button>
                  )}
                </div>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      const confirmation = window.prompt(
                        `This permanently deletes every record for this anytime log. Export your data first if you want a copy.\n\nType "${title.trim()}" to delete.`,
                      )
                      if (confirmation?.trim() === title.trim()) {
                        onDelete()
                        closeDialog()
                      }
                    }}
                    className="anytime-delete-button"
                  >
                    <Trash2 aria-hidden="true" /> Delete permanently
                  </button>
                ) : null}
              </section>
            ) : null}

            {error ? (
              <p id={errorId} role="alert" className="anytime-dialog-error">
                {error}
              </p>
            ) : null}

            <button type="submit" className="add-habit-submit anytime-dialog-submit">
              {isEdit ? <Save aria-hidden="true" /> : <Sprout aria-hidden="true" />}
              {isEdit
                ? 'Save changes'
                : profile === 'hana'
                  ? 'Create anytime log'
                  : 'Add anytime log'}
            </button>
          </>
        ) : null}
      </form>
    </dialog>
  )
}

function validateOpenActivity(
  input: NewOpenActivityInput,
  existingTitles: string[],
): { field: Exclude<ErrorField, 'form'>; message: string } | null {
  const message = getNewOpenActivityValidationError(input, existingTitles)
  if (!message) return null

  const title = input.title.trim()
  const hasDuplicateTitle = existingTitles.some(
    (existingTitle) =>
      existingTitle.trim().toLocaleLowerCase() ===
      title.toLocaleLowerCase(),
  )
  if (!title || title.length > OPEN_ACTIVITY_LIMITS.title || hasDuplicateTitle) {
    return { field: 'title', message }
  }
  if (
    !input.description.trim() ||
    input.description.trim().length > OPEN_ACTIVITY_LIMITS.description
  ) {
    return { field: 'description', message }
  }
  return { field: 'unit', message }
}
