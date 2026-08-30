import {
  BarChart3,
  BookOpen,
  Check,
  Hourglass,
  Infinity,
  Plus,
  Sprout,
  Star,
  Sunrise,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AddSomedayDialog } from '@/components/AddSomedayDialog'
import { ProfileTopBar } from '@/components/ProfileTopBar'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { NewSomedayItemInput, SomedayItem } from '@/types'

type Props = {
  profile: 'hana' | 'cramble'
  items: SomedayItem[]
  onAdd: (input: NewSomedayItemInput) => string | null
  onToggle: (itemId: string) => void
  onBack: () => void
  onOpenToday: () => void
  onOpenDestination: () => void
  onOpenLedger: () => void
}

export function SomedayPage({
  profile,
  items,
  onAdd,
  onToggle,
  onBack,
  onOpenToday,
  onOpenDestination,
  onOpenLedger,
}: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const headingRef = usePageHeadingFocus()
  const activeItems = items.filter((item) => !item.completedDate)
  const completedItems = [...items]
    .filter((item) => item.completedDate)
    .sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''))
  const groups = useMemo(() => groupActiveItems(activeItems), [activeItems])
  const destination = profile === 'hana' ? 'Garden' : 'Observatory'

  return (
    <div
      className={`someday-shell someday-shell-${profile} ${
        profile === 'cramble' ? 'cramble-archive-shell' : ''
      } mx-auto min-h-full w-full max-w-md px-5 pb-7 pt-6`}
    >
      {profile === 'cramble' ? <div className="cramble-decor-layer" aria-hidden="true" /> : null}
      <ProfileTopBar profile={profile} onBack={onBack} />

      <main className="someday-main relative z-10">
        <header className="someday-header">
          <h1 ref={headingRef} tabIndex={-1}>Someday</h1>
          <p>A quiet place for the life you want to live.</p>
        </header>

        {groups.length ? (
          <section className="someday-timeline" aria-label="Things still waiting">
            {groups.map((group) => (
              <SomedayGroup
                key={group.key}
                label={group.label}
                note={group.note}
                type={group.type}
                items={group.items}
                onToggle={onToggle}
              />
            ))}
          </section>
        ) : (
          <section className="someday-empty" aria-label="Someday is empty">
            <Infinity aria-hidden="true" />
            <p>Your next possibility can begin here.</p>
          </section>
        )}

        {completedItems.length ? (
          <section className="someday-memories" aria-labelledby="someday-memories-title">
            <div className="someday-memories-heading">
              <Sprout aria-hidden="true" />
              <h2 id="someday-memories-title">Memories made</h2>
            </div>
            <div className="someday-memory-list">
              {completedItems.map((item) => (
                <button
                  type="button"
                  className="someday-memory-row"
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  aria-label={`Mark ${item.title} as unfinished`}
                >
                  <span className="someday-check is-complete" aria-hidden="true">
                    <Check />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>Completed · {formatCompletionDate(item.completedDate)}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <button type="button" onClick={() => setIsAdding(true)} className="someday-add-button">
          <Plus aria-hidden="true" />
          Add something
        </button>
      </main>

      <nav
        className={`profile-action-bar profile-action-bar-${profile} someday-action-bar`}
        aria-label={`${profile === 'hana' ? 'Hana' : 'Cramble'} Someday actions`}
      >
        <button type="button" onClick={onOpenToday} className="profile-action-button" aria-label="Return to Today and add a habit">
          <span className={profile === 'cramble' ? 'cramble-action-icon' : 'someday-nav-icon'} aria-hidden="true"><Plus /></span>
          <span className="profile-action-copy"><span className="profile-action-label">Add habit</span></span>
        </button>
        <button type="button" onClick={onOpenDestination} className="profile-action-button" aria-label={`Open ${destination}`}>
          <span className={profile === 'cramble' ? 'cramble-action-icon' : 'someday-nav-icon'} aria-hidden="true">
            {profile === 'hana' ? <Sprout /> : <Star />}
          </span>
          <span className="profile-action-copy"><span className="profile-action-label">{destination}</span></span>
        </button>
        <button type="button" className="profile-action-button is-active" aria-current="page">
          <span className={profile === 'cramble' ? 'cramble-action-icon' : 'someday-nav-icon'} aria-hidden="true"><Sunrise /></span>
          <span className="profile-action-copy"><span className="profile-action-label">Someday</span></span>
        </button>
        <button type="button" onClick={onOpenLedger} className="profile-action-button" aria-label="Open the Ledger">
          <span className={profile === 'cramble' ? 'cramble-action-icon' : 'someday-nav-icon'} aria-hidden="true">
            {profile === 'hana' ? <BookOpen /> : <BarChart3 />}
          </span>
          <span className="profile-action-copy"><span className="profile-action-label">Ledger</span></span>
        </button>
      </nav>

      {isAdding ? (
        <AddSomedayDialog
          profile={profile}
          existingItems={items}
          onClose={() => setIsAdding(false)}
          onSubmit={onAdd}
        />
      ) : null}
    </div>
  )
}

type Group = {
  key: string
  label: string
  note: string
  type: 'timeless' | 'beforeAge'
  items: SomedayItem[]
}

function groupActiveItems(items: SomedayItem[]): Group[] {
  const timeless = items.filter((item) => item.timing === 'timeless')
  const ageGroups = new Map<number, SomedayItem[]>()
  items
    .filter((item) => item.timing === 'beforeAge' && item.targetAge !== null)
    .forEach((item) => {
      const age = item.targetAge as number
      ageGroups.set(age, [...(ageGroups.get(age) ?? []), item])
    })
  return [
    ...(timeless.length ? [{
      key: 'timeless',
      label: 'Anytime',
      note: 'No deadline',
      type: 'timeless' as const,
      items: timeless,
    }] : []),
    ...[...ageGroups.entries()]
      .sort(([ageA], [ageB]) => ageA - ageB)
      .map(([age, groupedItems]) => ({
        key: `age-${age}`,
        label: `Before ${age}`,
        note: 'A gentle horizon',
        type: 'beforeAge' as const,
        items: groupedItems,
      })),
  ]
}

function SomedayGroup({
  label,
  note,
  type,
  items,
  onToggle,
}: Omit<Group, 'key'> & { onToggle: (itemId: string) => void }) {
  return (
    <div className="someday-group">
      <div className="someday-group-heading">
        <span className="someday-group-icon" aria-hidden="true">
          {type === 'timeless' ? <Infinity /> : <Hourglass />}
        </span>
        <div>
          <h2>{label}</h2>
          <span>· {note}</span>
        </div>
      </div>
      <div className="someday-group-items">
        {items.map((item) => (
          <button
            type="button"
            className="someday-item-row"
            key={item.id}
            onClick={() => onToggle(item.id)}
            aria-label={`Mark ${item.title} complete`}
          >
            <span className="someday-check" aria-hidden="true" />
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

function formatCompletionDate(dateKey: string | null) {
  if (!dateKey) return ''
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
