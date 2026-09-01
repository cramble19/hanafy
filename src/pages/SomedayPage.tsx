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
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AddSomedayDialog } from '@/components/AddSomedayDialog'
import { ProfileTopBar } from '@/components/ProfileTopBar'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import type { NewSomedayItemInput, SomedayItem } from '@/types'

type Props = {
  profile: 'hana' | 'cramble'
  items: SomedayItem[]
  onAdd: (input: NewSomedayItemInput) => string | null
  onUpdate: (itemId: string, input: NewSomedayItemInput) => string | null
  onDelete: (itemId: string) => void
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
  onUpdate,
  onDelete,
  onToggle,
  onBack,
  onOpenToday,
  onOpenDestination,
  onOpenLedger,
}: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const headingRef = usePageHeadingFocus()
  const interactionHintId = useId()
  const activeItems = items.filter((item) => !item.completedDate)
  const completedItems = [...items]
    .filter((item) => item.completedDate)
    .sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''))
  const groups = useMemo(() => groupActiveItems(activeItems), [activeItems])
  const activeItemNumbers = useMemo(() => new Map(
    groups.flatMap((group) => group.items).map((item, index) => [item.id, index + 1]),
  ), [groups])
  const editingItem = items.find((item) => item.id === editingItemId)
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
          <div className="someday-waiting-summary">
            <strong>{activeItems.length} {activeItems.length === 1 ? 'thing' : 'things'} waiting</strong>
            <span id={interactionHintId}>Tap to complete · Hold to edit</span>
          </div>
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
                itemNumbers={activeItemNumbers}
                onToggle={onToggle}
                onEdit={setEditingItemId}
                interactionHintId={interactionHintId}
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
              <span
                className="someday-memories-count"
                aria-label={`${completedItems.length} ${completedItems.length === 1 ? 'memory' : 'memories'} made`}
              >
                {completedItems.length}
              </span>
            </div>
            <div className="someday-memory-list">
              {completedItems.map((item) => (
                <SomedayPressButton
                  className="someday-memory-row"
                  key={item.id}
                  item={item}
                  completed
                  onToggle={onToggle}
                  onEdit={setEditingItemId}
                  interactionHintId={interactionHintId}
                >
                  <span className="someday-check is-complete" aria-hidden="true">
                    <Check />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>Completed · {formatCompletionDate(item.completedDate)}</small>
                  </span>
                </SomedayPressButton>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setEditingItemId(null)
            setIsAdding(true)
          }}
          className="someday-add-button"
        >
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

      {isAdding || editingItem ? (
        <AddSomedayDialog
          profile={profile}
          existingItems={items}
          item={editingItem}
          onClose={() => {
            setIsAdding(false)
            setEditingItemId(null)
          }}
          onSubmit={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
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
  itemNumbers,
  onToggle,
  onEdit,
  interactionHintId,
}: Omit<Group, 'key'> & {
  itemNumbers: Map<string, number>
  onToggle: (itemId: string) => void
  onEdit: (itemId: string) => void
  interactionHintId: string
}) {
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
          <SomedayPressButton
            className="someday-item-row"
            key={item.id}
            item={item}
            completed={false}
            onToggle={onToggle}
            onEdit={onEdit}
            interactionHintId={interactionHintId}
          >
            <span className="someday-item-number" aria-hidden="true">
              {String(itemNumbers.get(item.id) ?? 0).padStart(2, '0')}
            </span>
            <strong>{item.title}</strong>
          </SomedayPressButton>
        ))}
      </div>
    </div>
  )
}

const SOMEDAY_HOLD_DELAY_MS = 520
const SOMEDAY_HOLD_MOVE_TOLERANCE_PX = 10

function SomedayPressButton({
  className,
  item,
  completed,
  onToggle,
  onEdit,
  interactionHintId,
  children,
}: {
  className: string
  item: SomedayItem
  completed: boolean
  onToggle: (itemId: string) => void
  onEdit: (itemId: string) => void
  interactionHintId: string
  children: ReactNode
}) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
  } | null>(null)
  const suppressNextClickRef = useRef(false)
  const lastEditTimeRef = useRef(0)

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  useEffect(() => () => clearHoldTimer(), [])

  const openEditor = () => {
    lastEditTimeRef.current = Date.now()
    onEdit(item.id)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    clearHoldTimer()
    suppressNextClickRef.current = false
    pressStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    holdTimerRef.current = setTimeout(() => {
      if (!pressStartRef.current) return
      holdTimerRef.current = null
      suppressNextClickRef.current = true
      openEditor()
    }, SOMEDAY_HOLD_DELAY_MS)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pressStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY)
      <= SOMEDAY_HOLD_MOVE_TOLERANCE_PX) return
    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pressStartRef.current?.pointerId !== event.pointerId) return
    clearHoldTimer()
    pressStartRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelPointer = () => {
    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
    if (Date.now() - lastEditTimeRef.current < 800) return
    openEditor()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const opensEditor = event.key === 'F2' || event.key === 'ContextMenu' ||
      (event.key === 'F10' && event.shiftKey)
    if (!opensEditor) return
    event.preventDefault()
    openEditor()
  }

  return (
    <button
      type="button"
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={() => {
        const interrupted = pressStartRef.current !== null
        clearHoldTimer()
        pressStartRef.current = null
        if (interrupted) suppressNextClickRef.current = true
      }}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false
          return
        }
        onToggle(item.id)
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      aria-describedby={interactionHintId}
      aria-keyshortcuts="Enter Space F2 Shift+F10 ContextMenu"
      aria-pressed={completed}
      aria-label={`${completed ? 'Restore' : 'Complete'} ${item.title}. Hold or press F2 to edit.`}
      title={`${completed ? 'Tap to restore' : 'Tap to complete'} · Hold to edit`}
    >
      {children}
    </button>
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
