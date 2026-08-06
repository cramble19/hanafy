import { useState, type FormEvent } from 'react'
import { ChevronLeft, KeyRound, LockKeyhole } from 'lucide-react'
import { isCramblePassword } from '@/lib/crambleGame'

type Props = {
  onBack: () => void
  onUnlock: () => void
}

export function CrambleGatePage({ onBack, onUnlock }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isCramblePassword(password)) {
      setError('That word does not open this chronicle.')
      return
    }

    setError('')
    onUnlock()
  }

  return (
    <div className="cramble-archive-shell cramble-gate-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6">
      <div className="cramble-decor-layer" aria-hidden="true" />
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to home"
        className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/90 text-ink shadow-sm outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ink/40 motion-reduce:transition-none"
      >
        <ChevronLeft className="size-5" />
      </button>

      <main className="relative z-10 grid flex-1 place-items-center">
        <form
          onSubmit={submit}
          className="cramble-codex-card w-full rounded-[28px] border border-border bg-surface p-6 text-center shadow-sm"
        >
          <div className="cramble-key-medallion mx-auto grid size-20 place-items-center rounded-full">
            <LockKeyhole className="size-9" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-faint">
            Cramble's screen gate
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Enter the Archive
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            A small shared word marks the threshold. This is a casual screen
            gate, not an account sign-in.
          </p>

          <label
            htmlFor="cramble-password"
            className="mt-6 block text-left text-xs font-semibold uppercase tracking-[0.14em] text-faint"
          >
            Archive word
          </label>
          <div className="relative mt-2">
            <KeyRound
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <input
              id="cramble-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) setError('')
              }}
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby="cramble-password-error"
              className="h-12 w-full rounded-control border border-border bg-surface-2 pl-11 pr-4 text-base text-ink outline-none transition placeholder:text-faint focus:border-[color:var(--cramble-brass)] focus:ring-2 focus:ring-[color:rgba(138,90,24,0.2)]"
              placeholder="Enter the word"
            />
          </div>
          <p
            id="cramble-password-error"
            className="mt-2 min-h-5 text-left text-sm text-danger"
            aria-live="polite"
          >
            {error}
          </p>

          <button
            type="submit"
            className="cramble-primary-button mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:rgba(138,90,24,0.35)] motion-reduce:transition-none"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Unlock Cramble's chronicle
          </button>
        </form>
      </main>
    </div>
  )
}
