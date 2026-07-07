import { useState } from 'react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { SunMark } from '@/components/icons/SunMark'

type Props = {
  onSelectHana: () => void
}

export function HomePage({ onSelectHana }: Props) {
  const [showSoon, setShowSoon] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <header className="mb-14 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
          A little garden for two
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          <button
            type="button"
            onClick={() => setShowPhoto(true)}
            className="rounded-control outline-none transition hover:text-muted focus-visible:ring-2 focus-visible:ring-ink/35 motion-reduce:transition-none"
            aria-label="Open a hidden memory"
          >
            Whose
          </button>{' '}
          day is it?
        </h1>
      </header>

      <div className="flex items-start justify-center gap-8">
        <button
          type="button"
          onClick={onSelectHana}
          aria-label="Open Hana's tracker"
          className="emblem-btn flex flex-col items-center gap-4 outline-none"
        >
          <span className="emblem-wrap">
            <span className="emblem emblem-flower">
              <FlowerMark className="size-20" />
            </span>
          </span>
          <span className="text-lg font-medium text-ink">Hana</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSoon(true)}
          aria-label="Cramble's tracker, coming soon"
          className="emblem-btn flex flex-col items-center gap-4 outline-none"
        >
          <span className="emblem-wrap is-delayed opacity-80">
            <span className="emblem emblem-sun">
              <SunMark className="size-20" />
            </span>
          </span>
          <span className="flex items-center gap-2 text-lg font-medium text-muted">
            Cramble
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-faint">
              Soon
            </span>
          </span>
        </button>
      </div>

      <p
        aria-live="polite"
        className={`mt-12 h-5 text-center text-sm text-muted transition-opacity duration-300 ${
          showSoon ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {showSoon ? "Cramble's garden is coming soon 🌻" : ''}
      </p>

      {showPhoto ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="A hidden memory"
          onClick={() => setShowPhoto(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[28px] border border-white/60 bg-surface p-3 shadow-[0_24px_80px_rgba(43,38,32,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src="/couple-watercolor.png"
              alt="A watercolor portrait of us together"
              className="aspect-[4/3] w-full rounded-[22px] object-cover"
            />
            <div className="px-2 pb-2 pt-4 text-center">
              <p className="text-sm font-medium text-ink">
                A little garden for us.
              </p>
              <button
                type="button"
                onClick={() => setShowPhoto(false)}
                className="mt-3 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-muted transition active:scale-95 motion-reduce:transition-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
