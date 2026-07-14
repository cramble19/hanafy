import { ChevronLeft, Flower2, Sparkles } from 'lucide-react'
import { FlowerMark } from '@/components/icons/FlowerMark'

type Props = {
  onBack: () => void
  onStart: () => void
  onExplore: () => void
  isSaving: boolean
  statusText: string
}

export function HanaStartPage({
  onBack,
  onStart,
  onExplore,
  isSaving,
  statusText,
}: Props) {
  return (
    <div className="hana-start-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6">
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/88 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur">
          Hana's promise
        </span>
      </div>

      <main className="grid flex-1 place-items-center">
        <section className="hana-start-card w-full rounded-[28px] border border-border bg-surface p-6 text-center shadow-sm">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-surface-2">
            <FlowerMark className="size-12 flower-pulse" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-faint">
            Start only when Hana says yes
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Start Health Overhaul
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Press this start button only when you are 100% ready to give it your
            all, daily. Remember why this app exists, and who created it for who.
            Please use it wisely.
          </p>

          <button
            type="button"
            onClick={onStart}
            disabled={isSaving}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
          >
            <Sparkles className="size-4" />
            {isSaving ? 'Starting health overhaul...' : 'Start Health Overhaul'}
          </button>

          <button
            type="button"
            onClick={onExplore}
            disabled={isSaving}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-ink shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
          >
            <Flower2 className="size-4 text-success" />
            Explore without committing
          </button>

          <p className="mt-4 text-xs leading-5 text-faint">{statusText}</p>
        </section>
      </main>
    </div>
  )
}
