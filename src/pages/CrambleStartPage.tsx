import { BookOpen, ChevronLeft, Compass } from 'lucide-react'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'

type Props = {
  onBack: () => void
  onStart: () => void
  isSaving: boolean
  isOffline: boolean
  statusText: string
}

export function CrambleStartPage({
  onBack,
  onStart,
  isSaving,
  isOffline,
  statusText,
}: Props) {
  const headingRef = usePageHeadingFocus()

  return (
    <div
      className="cramble-archive-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6"
      aria-busy={isSaving}
    >
      <div className="cramble-decor-layer" aria-hidden="true" />
      <div className="relative z-10 mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/90 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="rounded-full border border-border bg-surface/75 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
          The Sunward Archive
        </span>
      </div>

      <main className="relative z-10 grid flex-1 place-items-center">
        <section className="cramble-codex-card w-full rounded-[28px] border border-border bg-surface p-6 text-center shadow-sm">
          <div className="cramble-compass-medallion mx-auto grid size-20 place-items-center rounded-full">
            <Compass className="size-10" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-faint">
            Chapter I · The First Oath
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-3xl font-semibold tracking-tight text-ink outline-none"
          >
            Begin the Chronicle
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Begin when you are ready to keep a few small promises to yourself.
            Missed days do not end the story; returning writes the next page.
          </p>

          <button
            type="button"
            onClick={onStart}
            disabled={isSaving || isOffline}
            className="cramble-primary-button mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm outline-none transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[color:rgba(138,90,24,0.35)] motion-reduce:transition-none"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            {isSaving
              ? 'Opening the chronicle...'
              : isOffline
                ? 'Connect to begin'
                : 'Begin the First Oath'}
          </button>

          <p
            className="mt-4 text-xs leading-5 text-faint"
            role="status"
            aria-live="polite"
          >
            {statusText}
          </p>
        </section>
      </main>
    </div>
  )
}
