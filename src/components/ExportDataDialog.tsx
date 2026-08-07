import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Database, Download, FileText, ShieldCheck, Table2, X } from 'lucide-react'
import { downloadProfileChronicle } from '@/lib/habitChronicle'
import {
  downloadProfileCsv,
  downloadProfileJson,
} from '@/lib/habitExport'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import type { HanaGameState, Quest } from '@/types'

type ExportFormat = 'chronicle' | 'csv' | 'json'

type Props = {
  profile: HanaProfileId
  game: HanaGameState
  baseQuests: Quest[]
  onClose: () => void
}

const FORMAT_OPTIONS: Array<{
  value: ExportFormat
  title: string
  extension: string
  description: string
}> = [
  {
    value: 'chronicle',
    title: 'Progress report',
    extension: '.html',
    description:
      'A beautiful offline record with summaries, habit rhythms, and full goal-window history. It can also be printed as a PDF.',
  },
  {
    value: 'csv',
    title: 'Spreadsheet',
    extension: '.csv',
    description:
      'Detailed rows for habits, periods, occurrences, pauses, and corrections. Best for Excel or Google Sheets.',
  },
  {
    value: 'json',
    title: 'Complete backup',
    extension: '.json',
    description:
      'Versioned profile state plus resolved habit definitions. Best for safekeeping; the app does not import it yet.',
  },
]

export function ExportDataDialog({
  profile,
  game,
  baseQuests,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [format, setFormat] = useState<ExportFormat>('chronicle')

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

  const exportData = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (format === 'chronicle') {
      downloadProfileChronicle(game, baseQuests, profile)
    } else if (format === 'csv') {
      downloadProfileCsv(game, baseQuests, profile)
    } else {
      downloadProfileJson(game, baseQuests, profile)
    }

    close()
  }

  const eyebrow = profile === 'hana' ? 'Garden keepsake' : 'Archive dispatch'
  const submitLabel =
    format === 'chronicle'
      ? 'Download report'
      : format === 'csv'
        ? 'Download CSV'
        : 'Download backup'

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
        onSubmit={exportData}
        className="add-habit-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="add-habit-heading-icon" aria-hidden="true">
              <Download className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                {eyebrow}
              </p>
              <h2 id={titleId} className="mt-0.5 text-2xl font-semibold text-ink">
                Export your progress
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close export dialog"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          Download every habit and its recorded history through the current
          tracking day. Choose the version that is most useful to you.
        </p>

        <fieldset className="mt-5">
          <legend className="add-habit-label">Export format</legend>
          <div className="mt-2 grid gap-2">
            {FORMAT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="pause-choice min-h-20 w-full !items-start py-3"
                data-selected={format === option.value}
              >
                <input
                  type="radio"
                  name="export-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                />
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink"
                    aria-hidden="true"
                  >
                    <FormatIcon format={option.value} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">
                        {option.title}{' '}
                        <span className="font-medium text-faint">
                          {option.extension}
                        </span>
                      </span>
                      {option.value === 'chronicle' ? (
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted">
                          Recommended
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-faint">
                      {option.description}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex items-start gap-2 rounded-control border border-border bg-surface-2 p-3 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
          <p>{format === 'chronicle'
            ? 'Created on this device; nothing is uploaded. Private pause reasons and notes are left out of this shareable report.'
            : 'Created on this device; nothing is uploaded. Keep the file private because it includes personal tracking history and may contain pause reasons.'}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3 max-[360px]:grid-cols-1">
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted"
          >
            Cancel
          </button>
          <button type="submit" className="add-habit-submit">
            <Download className="size-4" aria-hidden="true" />
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function FormatIcon({ format }: { format: ExportFormat }) {
  if (format === 'chronicle') {
    return <FileText className="size-4" />
  }
  if (format === 'csv') {
    return <Table2 className="size-4" />
  }
  return <Database className="size-4" />
}
