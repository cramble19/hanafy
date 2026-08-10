import { Check, Plus } from 'lucide-react'
import type { Quest } from '@/types'
import { formatQuestCadence } from '@/lib/hanaStats'

type Props = {
  quests: Quest[]
  activationDates: Record<string, string>
  currentDate: string
  onAdd: (questId: string) => void
}

export function AvailableQuestsSection({
  quests,
  activationDates,
  currentDate,
  onAdd,
}: Props) {
  if (!quests.length) return null

  return (
    <section className="available-quests-section rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          Available quests
        </p>
        <h2 className="mt-1 text-xl font-semibold text-ink">
          Add one when it feels right
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted">
          Nothing is added automatically. There is no slot limit.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {quests.map((quest) => {
          const activationDate = activationDates[quest.id]
          const isPending = Boolean(
            activationDate && activationDate > currentDate,
          )
          return (
            <article
              key={quest.id}
              className="available-quest-row flex items-center gap-3 rounded-control border border-border bg-surface-2 p-3"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full text-xl"
                style={{
                  backgroundColor: `${quest.color}1a`,
                  boxShadow: `inset 0 0 0 1.5px ${quest.color}55`,
                }}
              >
                {quest.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-ink">
                  {quest.title}
                </strong>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {formatQuestCadence(quest)} · {quest.description}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onAdd(quest.id)}
                disabled={isPending}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-ink outline-none transition active:scale-95 disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
                aria-label={
                  isPending
                    ? `${quest.title} will begin next tracker day`
                    : `Add ${quest.title} to Hana's quests starting next tracker day`
                }
              >
                {isPending ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {isPending ? 'Added' : 'Add'}
              </button>
            </article>
          )
        })}
      </div>
      <p className="mt-3 text-center text-[11px] leading-5 text-faint">
        Added quests begin with the next 4 AM tracker day.
      </p>
    </section>
  )
}
