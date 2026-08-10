import { Settings, SkipForward, Undo2, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { Quest, GameState } from '@/types'
import type { HanaProfileId } from '@/lib/hanaCloudSync'
import { flowersForQuest } from '@/lib/hanaGame'
import { formatQuestCadence } from '@/lib/hanaStats'
import { getHabitSettings } from '@/lib/habitLifecycle'
import { getQuestCompletionProgress } from '@/lib/questCompletion'
import type { PeriodGoalProgress } from '@/components/QuestCard'

type Props = {
  profile: HanaProfileId
  game: GameState
  baseQuests: Quest[]
  quest: Quest
  checked: boolean
  skipped: boolean
  canSkip: boolean
  periodProgress?: PeriodGoalProgress
  onClose: () => void
  onManage: () => void
  onSkip: () => void
  onUndoOccurrence?: () => void
}

export function QuestInfoDialog({
  profile,
  game,
  baseQuests,
  quest,
  checked,
  skipped,
  canSkip,
  periodProgress,
  onClose,
  onManage,
  onSkip,
  onUndoOccurrence,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const completion = getQuestCompletionProgress(
    game,
    baseQuests,
    profile,
    quest,
  )
  const settings = getHabitSettings(game, quest.id)
  const graduation = settings.completion.graduation
  const reward = flowersForQuest(quest)
  const rewardWord = profile === 'hana'
    ? reward === 1 ? 'flower' : 'flowers'
    : 'renown'
  const skipDisabled = checked || (!canSkip && !skipped)

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
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const openSettings = () => {
    close()
    window.setTimeout(onManage, 0)
  }

  return (
    <dialog
      ref={dialogRef}
      className={`add-habit-dialog add-habit-dialog-${profile} quest-info-dialog quest-info-dialog-${profile}`}
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
      <section
        className="add-habit-panel quest-info-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-full text-2xl"
              style={{
                backgroundColor: `${quest.color}1a`,
                boxShadow: `inset 0 0 0 1.5px ${quest.color}66`,
              }}
              aria-hidden="true"
            >
              {quest.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                {profile === 'hana' ? 'Quest details' : 'Quest record'}
              </p>
              <h2 id={titleId} className="mt-0.5 text-2xl font-semibold text-ink">
                {quest.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close quest information"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          {quest.description}
        </p>

        <section className="quest-info-journey mt-5" aria-labelledby={`${titleId}-journey`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                Quest journey
              </p>
              <h3 id={`${titleId}-journey`} className="mt-1 text-base font-semibold text-ink">
                {graduation
                  ? `Blooms after ${graduation.effectiveDate}`
                  : completion.paths.length > 1
                    ? 'Complete either path'
                    : 'Complete this path'}
              </h3>
            </div>
            {completion.isMet ? (
              <span className="quest-info-ready">Ready to bloom</span>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {completion.paths.map((path) => {
              const percent = Math.min(100, Math.round((path.current / path.target) * 100))
              return (
                <div key={path.kind}>
                  <div className="mb-1.5 flex justify-between gap-3 text-xs text-muted">
                    <span>{getPathLabel(path.kind, path.target)}</span>
                    <strong className="font-semibold tabular-nums text-ink">
                      {Math.min(path.current, path.target)} / {path.target}
                    </strong>
                  </div>
                  <div className="quest-info-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-faint">
            A miss may restart only the combo. Total successes never disappear;
            skips, pauses, sick days and vacations stay neutral.
          </p>
        </section>

        <dl className="quest-info-facts mt-4">
          <Fact label="Rhythm" value={formatQuestCadence(quest)} />
          {periodProgress ? (
            <Fact
              label="Current period"
              value={`${periodProgress.completed} of ${periodProgress.target}${checked ? ' · complete' : ''}`}
            />
          ) : (
            <Fact label="Current period" value={checked ? 'Done' : skipped ? 'Neutral' : 'Open'} />
          )}
          <Fact label="Difficulty" value={capitalize(quest.difficulty)} />
          <Fact label="Reward" value={`+${reward} ${rewardWord} per successful goal period`} />
          {settings.cue ? <Fact label="Cue" value={settings.cue} /> : null}
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={skipDisabled}
            className="quest-info-action"
          >
            <SkipForward className="size-4" aria-hidden="true" />
            {skipped
              ? profile === 'hana' ? 'Undo skip' : 'Undo pass'
              : profile === 'hana' ? 'Skip this period' : 'Pass this period'}
          </button>
          <button type="button" onClick={openSettings} className="quest-info-action">
            <Settings className="size-4" aria-hidden="true" /> Settings
          </button>
          {periodProgress && periodProgress.completedToday > 0 && onUndoOccurrence ? (
            <button
              type="button"
              onClick={onUndoOccurrence}
              className="quest-info-action col-span-2"
            >
              <Undo2 className="size-4" aria-hidden="true" /> Undo latest record
            </button>
          ) : null}
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-faint">
          When this chapter blooms, it leaves Today while its history and earned
          rewards remain in the Ledger.
        </p>
      </section>
    </dialog>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getPathLabel(kind: string, target: number) {
  if (kind === 'oneTime') return 'Complete once'
  if (kind === 'combo') return `${target}-period combo`
  return `${target} successful periods total`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
