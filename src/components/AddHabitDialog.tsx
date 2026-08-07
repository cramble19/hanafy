import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  Archive,
  Bell,
  Pause,
  Plus,
  Save,
  Sprout,
  Sword,
  Trash2,
  X,
} from 'lucide-react'
import {
  CUSTOM_HABIT_LIMITS,
  formatHabitCadence,
  getMaximumPeriodLength,
  getNewHabitValidationError,
  resolveHabitPeriodPreset,
  type HabitFrequency,
  type HabitPeriodPreset,
  type HabitProfile,
  type NewHabitInput,
} from '@/lib/customHabits'
import { FLOWERS_BY_DIFFICULTY } from '@/lib/hanaGame'
import type { Difficulty } from '@/types'

type Props = {
  profile: HabitProfile
  existingTitles: string[]
  onClose: () => void
  onSubmit: (input: NewHabitInput) => string | null
  mode?: 'create' | 'edit'
  initialValue?: NewHabitInput
  rulesLocked?: boolean
  contentLocked?: boolean
  lifecycleStatus?: 'active' | 'paused' | 'archived'
  onRequestPause?: () => void
  onResume?: () => void
  onArchive?: () => void
  onRestore?: () => void
  onDelete?: () => void
}

type ErrorField = 'title' | 'description' | 'period' | 'target' | 'form'
const DIFFICULTIES: Array<{
  value: Difficulty
  label: string
  detail: string
}> = [
  { value: 'easy', label: 'Easy', detail: 'A small clear action' },
  { value: 'medium', label: 'Medium', detail: 'Needs real intention' },
  { value: 'hard', label: 'Hard', detail: 'A demanding objective' },
]

export function AddHabitDialog({
  profile,
  existingTitles,
  onClose,
  onSubmit,
  mode = 'create',
  initialValue,
  rulesLocked = false,
  contentLocked = false,
  lifecycleStatus = 'active',
  onRequestPause,
  onResume,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const periodInputRef = useRef<HTMLInputElement>(null)
  const targetInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const periodHelpId = useId()
  const targetHelpId = useId()
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [frequency, setFrequency] =
    useState<HabitFrequency>(initialValue?.frequency ?? 'oncePerPeriod')
  const [target, setTarget] = useState(String(initialValue?.target ?? 2))
  const [periodPreset, setPeriodPreset] =
    useState<HabitPeriodPreset>(() => getInitialPeriodPreset(initialValue))
  const [customDays, setCustomDays] = useState(
    String(
      initialValue?.periodUnit === 'weeks'
        ? (initialValue.periodLength ?? 1) * 7
        : initialValue?.periodLength ?? 3,
    ),
  )
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initialValue?.difficulty ?? 'easy',
  )
  const [cue, setCue] = useState(initialValue?.cue ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(
    Boolean(initialValue?.reminderTime),
  )
  const [reminderTime, setReminderTime] = useState(
    initialValue?.reminderTime ?? '20:00',
  )
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<ErrorField | null>(null)
  const notificationAvailability =
    'Notification' in window ? Notification.permission : 'unsupported'

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

  const { periodLength, periodUnit } = resolveHabitPeriodPreset(
    periodPreset,
    Number(customDays),
  )

  const closeDialog = () => {
    dialogRef.current?.close()
    onClose()
  }

  const submitHabit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input: NewHabitInput = {
      title,
      description,
      frequency,
      target: frequency === 'oncePerPeriod' ? 1 : Number(target),
      periodLength,
      periodUnit,
      difficulty,
      cue,
      reminderTime: reminderEnabled ? reminderTime : null,
    }
    const validationError = getNewHabitValidationError(input, existingTitles)
    if (validationError) {
      const field = getValidationField(input, existingTitles)
      setError(validationError)
      setErrorField(field)
      if (field === 'title') titleInputRef.current?.focus()
      if (field === 'description') descriptionInputRef.current?.focus()
      if (field === 'period') periodInputRef.current?.focus()
      if (field === 'target') targetInputRef.current?.focus()
      return
    }

    if (
      input.reminderTime &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission()
      } catch {
        // The habit still saves; the permission state is explained in the UI.
      }
    }

    const submitError = onSubmit(input)
    if (submitError) {
      setError(submitError)
      setErrorField('form')
      return
    }
    closeDialog()
  }

  const parsedPeriodLength = periodLength
  const parsedTarget = frequency === 'oncePerPeriod' ? 1 : Number(target)
  const hasValidPeriod =
    Number.isInteger(parsedPeriodLength) &&
    parsedPeriodLength >= 1 &&
    parsedPeriodLength <= CUSTOM_HABIT_LIMITS.periodDays
  const hasValidTarget =
    frequency === 'oncePerPeriod' ||
    (Number.isInteger(parsedTarget) &&
      parsedTarget >= 2 &&
      parsedTarget <= CUSTOM_HABIT_LIMITS.target)
  const cadence =
    hasValidPeriod && hasValidTarget
      ? formatHabitCadence({
          frequency,
          target: parsedTarget,
          periodLength: parsedPeriodLength,
          periodUnit,
        })
      : null
  const reward = FLOWERS_BY_DIFFICULTY[difficulty]
  const rewardWord =
    profile === 'hana' ? (reward === 1 ? 'flower' : 'flowers') : 'renown'
  const Icon = profile === 'hana' ? Sprout : Sword

  return (
    <dialog
      ref={dialogRef}
      className={`add-habit-dialog add-habit-dialog-${profile}`}
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
        onSubmit={submitHabit}
        className="add-habit-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="add-habit-heading-icon" aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                {mode === 'edit'
                  ? profile === 'hana'
                    ? 'Tend this quest'
                    : 'Revise this lesson'
                  : profile === 'hana'
                    ? 'New garden quest'
                    : 'New archive lesson'}
              </p>
              <h2 id={titleId} className="mt-0.5 text-2xl font-semibold text-ink">
                {mode === 'edit' ? 'Manage habit' : 'Add a habit'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close add habit"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          {mode === 'edit'
            ? 'Update its wording and cue without losing the record already built.'
            : 'Set a clear action and a flexible period. The reward arrives only when the whole period goal is complete.'}
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="add-habit-label">Habit name</span>
            <input
              ref={titleInputRef}
              name="habit-title"
              required
              autoFocus={!contentLocked}
              disabled={contentLocked}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                clearError()
              }}
              maxLength={CUSTOM_HABIT_LIMITS.title}
              aria-invalid={errorField === 'title'}
              aria-describedby={errorField === 'title' ? errorId : undefined}
              className="add-habit-input"
              placeholder="Morning walk"
            />
          </label>

          <label className="block">
            <span className="add-habit-label">What counts as complete?</span>
            <textarea
              ref={descriptionInputRef}
              name="habit-description"
              required
              disabled={contentLocked}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                clearError()
              }}
              maxLength={CUSTOM_HABIT_LIMITS.description}
              rows={3}
              aria-invalid={errorField === 'description'}
              aria-describedby={
                errorField === 'description' ? errorId : undefined
              }
              className="add-habit-input resize-none"
              placeholder="Walk briskly outside for at least 20 minutes."
            />
          </label>

          <fieldset>
            <legend className="add-habit-label">Goal pattern</legend>
            <div className="add-habit-pattern-grid">
              <label
                className={`add-habit-pattern ${frequency === 'oncePerPeriod' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="habit-frequency"
                  value="oncePerPeriod"
                  checked={frequency === 'oncePerPeriod'}
                  disabled={rulesLocked}
                  onChange={() => {
                    setFrequency('oncePerPeriod')
                    clearError()
                  }}
                  className="sr-only"
                />
                <span className="block font-semibold text-ink">
                  Once per period
                </span>
                <span className="mt-1 block text-xs leading-5 text-faint">
                  One record finishes the goal.
                </span>
              </label>
              <label
                className={`add-habit-pattern ${frequency === 'timesPerPeriod' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="habit-frequency"
                  value="timesPerPeriod"
                  checked={frequency === 'timesPerPeriod'}
                  disabled={rulesLocked}
                  onChange={() => {
                    setFrequency('timesPerPeriod')
                    if (Number(target) < 2) setTarget('2')
                    clearError()
                  }}
                  className="sr-only"
                />
                <span className="block font-semibold text-ink">
                  Several times
                </span>
                <span className="mt-1 block text-xs leading-5 text-faint">
                  Finish every repetition in the window.
                </span>
              </label>
            </div>
          </fieldset>

          {frequency === 'timesPerPeriod' ? (
            <label className="block">
              <span className="add-habit-label">
                Completions needed
                <span className="ml-1 font-normal normal-case tracking-normal text-faint">
                  (2–{CUSTOM_HABIT_LIMITS.target})
                </span>
              </span>
              <input
                ref={targetInputRef}
                name="habit-target"
                type="number"
                inputMode="numeric"
                required
                disabled={rulesLocked}
                min={2}
                max={CUSTOM_HABIT_LIMITS.target}
                step={1}
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value)
                  clearError()
                }}
                aria-invalid={errorField === 'target'}
                aria-describedby={`${targetHelpId}${errorField === 'target' ? ` ${errorId}` : ''}`}
                className="add-habit-input"
              />
              <span id={targetHelpId} className="mt-1.5 block text-xs leading-5 text-faint">
                Multiple completions can be recorded on the same day.
              </span>
            </label>
          ) : null}

          <fieldset aria-describedby={periodHelpId}>
            <legend className="add-habit-label">Schedule</legend>
            <div className="add-habit-schedule-grid">
              {(
                [
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['custom', 'Custom'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`add-habit-schedule-option ${periodPreset === value ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="habit-period-preset"
                    value={value}
                    checked={periodPreset === value}
                    disabled={rulesLocked}
                    onChange={() => {
                      setPeriodPreset(value)
                      clearError()
                    }}
                    className="sr-only"
                  />
                  <span>{label}</span>
                  <span className="add-habit-schedule-check" aria-hidden="true">
                    {periodPreset === value ? '✓' : ''}
                  </span>
                </label>
              ))}
            </div>

            {periodPreset === 'custom' ? (
              <label className="add-habit-custom-period">
                <span className="text-sm font-medium text-muted">Repeat every</span>
                <input
                  ref={periodInputRef}
                  name="habit-custom-days"
                  type="number"
                  inputMode="numeric"
                  required
                  disabled={rulesLocked}
                  min={1}
                  max={CUSTOM_HABIT_LIMITS.periodDays}
                  step={1}
                  value={customDays}
                  onChange={(event) => {
                    setCustomDays(event.target.value)
                    clearError()
                  }}
                  aria-label="Number of days in each rolling period"
                  aria-invalid={errorField === 'period'}
                  aria-describedby={`${periodHelpId}${errorField === 'period' ? ` ${errorId}` : ''}`}
                  className="add-habit-input"
                />
                <span className="text-sm font-medium text-muted">days</span>
              </label>
            ) : null}

            <span id={periodHelpId} className="mt-1.5 block text-xs leading-5 text-faint">
              {periodPreset === 'daily'
                ? 'A fresh goal starts every day.'
                : periodPreset === 'weekly'
                  ? 'A fresh calendar week starts every Sunday.'
                  : 'Rolling windows begin on the day you add the habit.'}
            </span>
          </fieldset>

          {rulesLocked ? (
            <p className="rounded-control border border-border bg-surface-2 p-3 text-xs leading-5 text-muted">
              Frequency and effort stay fixed after the first record so earlier
              periods and rewards are never rewritten. Archive this habit and
              add a revised one when its rhythm needs to change.
            </p>
          ) : null}

          <fieldset className="rounded-control border border-border bg-surface-2/55 p-3">
            <legend className="add-habit-label px-1">Cue and reminder</legend>
            <label className="mt-1 block">
              <span className="text-xs font-medium text-muted">After or when...</span>
              <input
                name="habit-cue"
                value={cue}
                onChange={(event) => setCue(event.target.value)}
                maxLength={CUSTOM_HABIT_LIMITS.cue}
                className="add-habit-input"
                placeholder="After breakfast"
              />
            </label>
            <label className="mt-3 flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Bell className="size-4" aria-hidden="true" /> Browser reminder
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-faint">
                  Uses this habit's name and cue. It catches up when this
                  profile is next open; completed, paused, and archived goals
                  stay quiet. Browser permission is required.
                </span>
              </span>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
                className="size-5 accent-current"
              />
            </label>
            {reminderEnabled ? (
              <>
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-muted">Reminder time</span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                    className="add-habit-input"
                  />
                </label>
                {notificationAvailability === 'denied' ? (
                  <p className="mt-2 text-xs leading-5 text-danger">
                    Notifications are blocked in this browser. The preference
                    will be saved, but delivery needs browser permission.
                  </p>
                ) : notificationAvailability === 'unsupported' ? (
                  <p className="mt-2 text-xs leading-5 text-faint">
                    This browser does not support habit notifications.
                  </p>
                ) : null}
              </>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="add-habit-label">Objective difficulty</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={difficulty === option.value}
                  disabled={rulesLocked}
                  onClick={() => {
                    setDifficulty(option.value)
                    clearError()
                  }}
                  className="add-habit-difficulty"
                >
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-faint">
                    +{FLOWERS_BY_DIFFICULTY[option.value]}
                  </span>
                  <span className="sr-only">
                    {option.detail}. Earns{' '}
                    {FLOWERS_BY_DIFFICULTY[option.value]}{' '}
                    {profile === 'hana' ? 'flowers' : 'renown'} when the period
                    goal is complete.
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {mode === 'edit' ? (
          <section className="mt-5 border-t border-border pt-4" aria-label="Habit lifecycle">
            <p className="add-habit-label">Tracking controls</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {lifecycleStatus === 'paused' ? (
                <button
                  type="button"
                  onClick={() => {
                    onResume?.()
                    closeDialog()
                  }}
                  className="habit-lifecycle-button"
                >
                  <Plus className="size-4" aria-hidden="true" /> Resume
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
                  <Pause className="size-4" aria-hidden="true" /> Pause
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
                  <Plus className="size-4" aria-hidden="true" /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Archive this habit? Its history and earned rewards stay, but it will stop appearing as due.',
                      )
                    ) {
                      onArchive?.()
                      closeDialog()
                    }
                  }}
                  className="habit-lifecycle-button"
                >
                  <Archive className="size-4" aria-hidden="true" /> Archive
                </button>
              )}
            </div>
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  const confirmation = window.prompt(
                    `This permanently deletes every record and removes earned points. Export your CSV first if you want a copy.\n\nType "${title.trim()}" to delete.`,
                  )
                  if (confirmation?.trim() === title.trim()) {
                    onDelete()
                    closeDialog()
                  }
                }}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-danger/35 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
              >
                <Trash2 className="size-4" aria-hidden="true" /> Delete permanently
              </button>
            ) : null}
          </section>
        ) : null}

        <div className="add-habit-reward-note" aria-live="polite">
          {cadence ? (
            <>
              <span className="block font-semibold text-ink">{cadence}</span>
              <span className="mt-1 block">
                Earn{' '}
                <span className="font-semibold text-ink">
                  +{reward} {rewardWord}
                </span>{' '}
                when {parsedTarget === 1 ? 'the period goal is' : `all ${parsedTarget} completions are`} recorded.
                Partial progress has no penalty and earns no partial reward.
              </span>
            </>
          ) : (
            <span className="font-medium text-muted">
              Enter a valid period and completion target to preview this rhythm.
            </span>
          )}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
          <button
            type="button"
            onClick={closeDialog}
            className="min-h-11 rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
          >
            Cancel
          </button>
          <button type="submit" className="add-habit-submit">
            {mode === 'edit' ? (
              <Save className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {mode === 'edit' ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function getInitialPeriodPreset(input?: NewHabitInput): HabitPeriodPreset {
  if (!input) return 'daily'
  if (input.periodUnit === 'weeks' && input.periodLength === 1) return 'weekly'
  if (input.periodUnit === 'days' && input.periodLength === 1) return 'daily'
  return 'custom'
}

function getValidationField(
  input: NewHabitInput,
  existingTitles: string[],
): ErrorField {
  const title = input.title.trim()
  if (
    !title ||
    title.length > CUSTOM_HABIT_LIMITS.title ||
    existingTitles.some(
      (existingTitle) =>
        existingTitle.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
  ) {
    return 'title'
  }

  const description = input.description.trim()
  if (
    !description ||
    description.length > CUSTOM_HABIT_LIMITS.description
  ) {
    return 'description'
  }

  if (
    !Number.isInteger(input.periodLength) ||
    input.periodLength < 1 ||
    input.periodLength > getMaximumPeriodLength(input.periodUnit)
  ) {
    return 'period'
  }

  if (
    (input.frequency === 'oncePerPeriod' && input.target !== 1) ||
    (input.frequency === 'timesPerPeriod' &&
      (!Number.isInteger(input.target) ||
        input.target < 2 ||
        input.target > CUSTOM_HABIT_LIMITS.target))
  ) {
    return 'target'
  }

  return 'form'
}
