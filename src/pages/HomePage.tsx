import { useState } from 'react'
import { FlowerMark } from '@/components/icons/FlowerMark'
import { SunMark } from '@/components/icons/SunMark'

type Props = {
  onSelectHana: () => void
}

export function HomePage({ onSelectHana }: Props) {
  const [showSoon, setShowSoon] = useState(false)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <header className="mb-14 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
          A little garden for two
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Whose day is it?
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
          aria-label="Your tracker, coming soon"
          className="emblem-btn flex flex-col items-center gap-4 outline-none"
        >
          <span className="emblem-wrap is-delayed opacity-80">
            <span className="emblem emblem-sun">
              <SunMark className="size-20" />
            </span>
          </span>
          <span className="flex items-center gap-2 text-lg font-medium text-muted">
            You
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
        {showSoon ? 'Your garden is coming soon 🌻' : ''}
      </p>
    </div>
  )
}
