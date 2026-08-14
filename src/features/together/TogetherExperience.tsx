import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { TogetherMark } from '@/components/icons/TogetherMark'
import { crambleQuests } from '@/data/crambleQuests'
import {
  CRAMBLE_QUEST_PLAN_OPTIONS,
} from '@/lib/crambleGame'
import {
  createInitialHanaState,
  parseStoredHanaState,
  syncStateToDate,
  todayKey,
} from '@/lib/hanaGame'
import { loadHanaStateFromDb } from '@/lib/hanaRemoteState'
import { readLocalProfileState } from '@/lib/profileCache'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { TogetherPage } from '@/pages/TogetherPage'
import type { HanaGameState } from '@/types'

type Props = {
  hanaGame: HanaGameState | null
  onBack: () => void
}

type ReadOnlyLoadState =
  | { status: 'loading' }
  | { status: 'ready'; game: HanaGameState; notice: string | null }
  | { status: 'error'; message: string }

export function TogetherExperience({ hanaGame, onBack }: Props) {
  const comparisonDate = useMemo(() => todayKey(), [])
  const [retrySequence, setRetrySequence] = useState(0)
  const [crambleLoad, setCrambleLoad] = useState<ReadOnlyLoadState>(() => {
    const local = readLocalProfileState('cramble', comparisonDate)
    return local
      ? { status: 'ready', game: local.state, notice: null }
      : { status: 'loading' }
  })

  useEffect(() => {
    let cancelled = false

    const finish = (next: ReadOnlyLoadState) => {
      if (!cancelled) setCrambleLoad(next)
    }

    const load = async () => {
      const local = readLocalProfileState('cramble', comparisonDate)
      if (local?.source === 'pending') {
        finish({
          status: 'ready',
          game: local.state,
          notice: import.meta.env.DEV
            ? null
            : 'Including Cramble actions saved on this device and waiting to sync.',
        })
        return
      }

      const cached = local?.state ?? null
      if (!cached) setCrambleLoad({ status: 'loading' })
      if (import.meta.env.DEV) {
        finish({
          status: 'ready',
          game: cached ?? createEmptyCrambleState(comparisonDate),
          notice: cached ? null : 'Cramble has no saved local journey yet.',
        })
        return
      }

      if (!navigator.onLine) {
        finish({
          status: 'ready',
          game: cached ?? createEmptyCrambleState(comparisonDate),
          notice: cached
            ? 'Offline right now. Showing Cramble’s saved device copy.'
            : 'Offline right now. Cramble’s journey is not available on this device.',
        })
        return
      }

      const remote = await loadHanaStateFromDb('cramble')
      if (!remote.ok) {
        if (cached) {
          finish({
            status: 'ready',
            game: cached,
            notice: 'The database could not be reached. Showing Cramble’s saved device copy.',
          })
          return
        }
        finish({ status: 'error', message: remote.error })
        return
      }

      if (!remote.snapshot) {
        finish({
          status: 'ready',
          game: cached ?? createEmptyCrambleState(comparisonDate),
          notice: cached
            ? 'The database returned no Cramble journey, so this device’s saved copy is shown.'
            : null,
        })
        return
      }

      const databaseGame = syncStateToDate(
        {
          ...parseStoredHanaState(
            JSON.stringify(remote.snapshot.state),
            crambleQuests,
            comparisonDate,
            CRAMBLE_QUEST_PLAN_OPTIONS,
          ),
          syncRevision: remote.snapshot.revision ?? 0,
        },
        crambleQuests,
        comparisonDate,
        CRAMBLE_QUEST_PLAN_OPTIONS,
      )
      finish({ status: 'ready', game: databaseGame, notice: null })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [comparisonDate, retrySequence])

  if (!hanaGame || crambleLoad.status === 'loading') {
    return <TogetherLoadingPage onBack={onBack} />
  }

  if (crambleLoad.status === 'error') {
    return (
      <TogetherErrorPage
        message={crambleLoad.message}
        onBack={onBack}
        onRetry={() => setRetrySequence((sequence) => sequence + 1)}
      />
    )
  }

  return (
    <TogetherPage
      hanaGame={hanaGame}
      crambleGame={crambleLoad.game}
      notice={crambleLoad.notice}
      onBack={onBack}
    />
  )
}

function createEmptyCrambleState(comparisonDate: string) {
  return syncStateToDate(
    { ...createInitialHanaState(), currentDate: comparisonDate },
    crambleQuests,
    comparisonDate,
    CRAMBLE_QUEST_PLAN_OPTIONS,
  )
}

function TogetherLoadingPage({ onBack }: { onBack: () => void }) {
  return (
    <TogetherStatusPage
      title="Opening your shared journey"
      description="Reading Hana and Cramble’s latest saved progress."
      announcementRole="status"
      onBack={onBack}
    />
  )
}

function TogetherErrorPage({
  message,
  onBack,
  onRetry,
}: {
  message: string
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <TogetherStatusPage
      title="The paths could not meet yet"
      description={`Cramble’s saved journey could not be read. ${message}`}
      announcementRole="alert"
      onBack={onBack}
      action={
        <button type="button" onClick={onRetry} className="together-home-button mt-5">
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      }
    />
  )
}

function TogetherStatusPage({
  title,
  description,
  announcementRole,
  onBack,
  action = null,
}: {
  title: string
  description: string
  announcementRole: 'status' | 'alert'
  onBack: () => void
  action?: ReactNode
}) {
  const headingRef = usePageHeadingFocus()

  return (
    <div className="together-shell mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="together-back-button relative z-10 grid size-11 place-items-center rounded-full border border-border bg-surface/90 text-ink outline-none"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        <span className="sr-only">Back to home</span>
      </button>
      <main className="relative z-10 grid flex-1 place-items-center text-center">
        <div className="together-status-card">
          <TogetherMark className="together-status-mark mx-auto" />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-semibold tracking-tight text-ink outline-none"
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm leading-6 text-muted"
            role={announcementRole}
          >
            {description}
          </p>
          {action}
        </div>
      </main>
    </div>
  )
}
