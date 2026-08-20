import { useEffect, useId, useRef, useState } from 'react'
import { CalendarClock, Minus, Plus, X } from 'lucide-react'
import {
  addDays,
  displayDate,
  getBackfillValidationError,
  getQuestCatalog,
  getQuestScheduleProgress,
} from '@/lib/hanaGame'
import { MAX_BACKFILL_DAYS } from '@/lib/habitLifecycle'
import {
  getOpenActivityCatalog,
  getOpenActivityDateValidationError,
  getOpenActivityValue,
} from '@/lib/openActivities'
import type { HanaGameState, Quest } from '@/types'

type Props = {
  profile: 'hana' | 'cramble'
  game: HanaGameState
  baseQuests: Quest[]
  onClose: () => void
  onRecord: (dateKey: string, habitId: string) => string | null
  onUndo: (dateKey: string, habitId: string) => string | null
  onRecordActivity: (dateKey: string, activityId: string) => string | null
  onUndoActivity: (dateKey: string, activityId: string) => string | null
}

export function BackfillDialog({
  profile,
  game,
  baseQuests,
  onClose,
  onRecord,
  onUndo,
  onRecordActivity,
  onUndoActivity,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const dates = Array.from({ length: MAX_BACKFILL_DAYS }, (_, index) =>
    addDays(game.currentDate, -(index + 1)),
  ).filter((dateKey) => !game.startDate || dateKey >= game.startDate)
  const [selectedDate, setSelectedDate] = useState(dates[0] ?? '')
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

  const catalog = getQuestCatalog(baseQuests, game)
  const eligible = selectedDate
    ? catalog.filter((quest) => {
        if (quest.group !== 'daily') return false
        if (getBackfillValidationError(game, quest, selectedDate)) return false
        if (quest.custom || quest.required) return true
        return game.activeDailyQuests?.[selectedDate]?.includes(quest.id)
      })
    : []
  const eligibleActivities = selectedDate
    ? getOpenActivityCatalog(game).filter(
        (activity) =>
          activity.kind !== 'rating' &&
          !getOpenActivityDateValidationError(
            game,
            activity.id,
            selectedDate,
          ),
      )
    : []

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
      <div className="add-habit-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="add-habit-heading-icon" aria-hidden="true">
              <CalendarClock className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                A gentle correction
              </p>
              <h2 id={titleId} className="mt-0.5 text-2xl font-semibold text-ink">
                Record a recent day
              </h2>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close recent-day recording" className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          Forgot to log something you did? Add it to the day it happened.
          Undo a mistaken record here too. Paused, archived, locked, and
          unscheduled habits stay neutral.
        </p>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose a recent date">
          {dates.map((dateKey) => (
            <button
              key={dateKey}
              type="button"
              onClick={() => {
                setSelectedDate(dateKey)
                setError(null)
              }}
              aria-pressed={selectedDate === dateKey}
              className="backfill-date-button"
            >
              {formatShortDate(dateKey)}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <p className="add-habit-label">
            {selectedDate ? displayDate(selectedDate) : 'No earlier tracker day'}
          </p>
          {eligible.length ? (
            <div className="space-y-2" aria-labelledby="recent-scheduled-heading">
              <h3 id="recent-scheduled-heading" className="add-habit-label">
                Scheduled habits
              </h3>
              {eligible.map((quest) => {
              const progress = getQuestScheduleProgress(game, quest, selectedDate)
              const isCounted = quest.schedule?.kind === 'periodTarget'
              const done = progress.isComplete
              const recordedOnDate = isCounted
                ? game.habitOccurrences?.[selectedDate]?.[quest.id] ?? 0
                : game.dailyCompletions?.[selectedDate]?.[quest.id]
                  ? 1
                  : 0
              const recordDisabled =
                done || (!isCounted && recordedOnDate > 0)
              return (
                <div key={quest.id} className="backfill-habit-row">
                  <span className="text-xl" aria-hidden="true">{quest.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{quest.title}</span>
                    <span className="block text-xs text-faint">
                      {isCounted
                        ? `${progress.completed}/${progress.target} in this goal window`
                        : done
                          ? 'Already recorded'
                          : 'Not recorded yet'}
                    </span>
                  </span>
                  <span className="backfill-row-actions">
                    {recordedOnDate > 0 ? (
                      <button
                        type="button"
                        aria-label={`Undo one ${quest.title} record on ${displayDate(selectedDate)}`}
                        onClick={() => {
                          const undoError = onUndo(selectedDate, quest.id)
                          setError(undoError)
                        }}
                        className="backfill-record-button"
                      >
                        <Minus className="size-4" aria-hidden="true" /> Undo 1
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={recordDisabled}
                      aria-label={
                        recordDisabled
                          ? `${quest.title} is already complete on ${displayDate(selectedDate)}`
                          : `Record ${quest.title} on ${displayDate(selectedDate)}`
                      }
                      onClick={() => {
                        const recordError = onRecord(selectedDate, quest.id)
                        setError(recordError)
                      }}
                      className="backfill-record-button"
                    >
                      {recordDisabled ? 'Done' : <><Plus className="size-4" aria-hidden="true" /> Record</>}
                    </button>
                  </span>
                </div>
              )
              })}
            </div>
          ) : null}

          {eligibleActivities.length ? (
            <div className="space-y-2" aria-labelledby="recent-anytime-heading">
              <div>
                <h3 id="recent-anytime-heading" className="add-habit-label">
                  Anytime logs
                </h3>
                <p className="mt-1 text-xs leading-5 text-faint">
                  Empty days stay neutral. Record only what happened.
                </p>
              </div>
              {eligibleActivities.map((activity) => {
                const value = getOpenActivityValue(
                  game,
                  activity.id,
                  selectedDate,
                )
                const isCheck = activity.kind === 'check'
                const unit = activity.unit || (value === 1 ? 'time' : 'times')
                return (
                  <div key={activity.id} className="backfill-habit-row">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {activity.title}
                      </span>
                      <span
                        className="block text-xs text-faint"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {isCheck
                          ? value > 0
                            ? 'Logged on this day'
                            : 'Once today · not logged'
                          : `${value} ${unit} on this day`}
                      </span>
                    </span>
                    <span className="backfill-row-actions">
                      {isCheck ? (
                        <button
                          type="button"
                          aria-pressed={value > 0}
                          aria-label={
                            value > 0
                              ? `Undo ${activity.title} on ${displayDate(selectedDate)}`
                              : `Log ${activity.title} on ${displayDate(selectedDate)}`
                          }
                          onClick={() => {
                            const actionError = value > 0
                              ? onUndoActivity(selectedDate, activity.id)
                              : onRecordActivity(selectedDate, activity.id)
                            setError(actionError)
                          }}
                          className="backfill-record-button"
                        >
                          {value > 0 ? (
                            <>
                              <Minus className="size-4" aria-hidden="true" />
                              Undo
                            </>
                          ) : (
                            <>
                              <Plus className="size-4" aria-hidden="true" />
                              Log
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          {value > 0 ? (
                            <button
                              type="button"
                              aria-label={`Subtract one from ${activity.title} on ${displayDate(selectedDate)}`}
                              onClick={() => {
                                const undoError = onUndoActivity(
                                  selectedDate,
                                  activity.id,
                                )
                                setError(undoError)
                              }}
                              className="backfill-record-button"
                            >
                              <Minus className="size-4" aria-hidden="true" />
                              −1
                            </button>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Add one to ${activity.title} on ${displayDate(selectedDate)}`}
                            onClick={() => {
                              const recordError = onRecordActivity(
                                selectedDate,
                                activity.id,
                              )
                              setError(recordError)
                            }}
                            className="backfill-record-button"
                          >
                            <Plus className="size-4" aria-hidden="true" />
                            +1
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

          {!eligible.length && !eligibleActivities.length ? (
            <p className="rounded-control border border-border bg-surface-2 p-4 text-sm leading-6 text-muted">
              No scheduled habits or anytime logs can be recorded on this date.
            </p>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}

        <button type="button" onClick={close} className="mt-5 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted">
          Done
        </button>
      </div>
    </dialog>
  )
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
