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
import type { HanaGameState, Quest } from '@/types'

type Props = {
  profile: 'hana' | 'cramble'
  game: HanaGameState
  baseQuests: Quest[]
  onClose: () => void
  onRecord: (dateKey: string, habitId: string) => string | null
  onUndo: (dateKey: string, habitId: string) => string | null
}

export function BackfillDialog({
  profile,
  game,
  baseQuests,
  onClose,
  onRecord,
  onUndo,
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

        <div className="mt-5 space-y-2">
          <p className="add-habit-label">
            {selectedDate ? displayDate(selectedDate) : 'No earlier tracker day'}
          </p>
          {eligible.length ? (
            eligible.map((quest) => {
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
            })
          ) : (
            <p className="rounded-control border border-border bg-surface-2 p-4 text-sm leading-6 text-muted">
              No habits were due and trackable on this date.
            </p>
          )}
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
