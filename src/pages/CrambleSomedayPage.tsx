import { BookOpen, BriefcaseBusiness, Check, ChevronRight, Compass, Footprints, HandHeart, Heart, HeartHandshake, House, Infinity, Plus, Search, Sprout, Tag, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { ProfileTopBar } from '@/components/ProfileTopBar'
import { AddSomedayDialog } from '@/components/AddSomedayDialog'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { formatCompletionDate, groupActiveItems, SomedayPressButton } from './SomedayPage'
import type { NewSomedayItemInput, SomedayCategories, SomedayItem } from '@/types'
import type { SomedayCategoryChange } from '@/lib/somedayCategories'
import './someday-categories.css'

type Props = {
  items: SomedayItem[]
  settings: SomedayCategories
  onAdd: (input: NewSomedayItemInput) => string | null
  onUpdate: (id: string, input: NewSomedayItemInput) => string | null
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onCategoryChange: (change: SomedayCategoryChange) => string | null
}
const icons = { travel: Compass, family: Heart, intimacy: HeartHandshake, body: Footprints, learning: BookOpen, career: BriefcaseBusiness, home: House, giving: HandHeart }

export function CrambleSomedayPage({ items, settings, onAdd, onUpdate, onDelete, onToggle, onCategoryChange }: Props) {
  const headingRef = usePageHeadingFocus()
  const hintId = useId()
  const [view, setView] = useState<'all' | 'category' | 'age'>('all')
  const [review, setReview] = useState<{ id: string; details: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const active = items.filter(item => !item.completedDate)
  const memories = items.filter(item => item.completedDate).sort((a, b) => b.completedDate!.localeCompare(a.completedDate!))
  const categoryName = (item: SomedayItem) => settings.categories[settings.assignments[item.id] ?? ''] ?? 'Unsorted'
  const needle = query.trim().toLocaleLowerCase()
  const matches = (item: SomedayItem) => !needle || `${item.title} ${item.description ?? ''} ${categoryName(item)}`.toLocaleLowerCase().includes(needle)
  const visibleActive = active.filter(matches)
  const visibleMemories = memories.filter(matches)
  const numbers = new Map(active.map((item, i) => [item.id, i + 1]))
  const groups = view === 'age'
    ? groupActiveItems(visibleActive).map(group => ({ ...group, Icon: Infinity }))
    : [...Object.entries(settings.categories), ['unsorted', 'Unsorted']].map(([id, name]) => ({
      key: id, label: name,
      Icon: icons[id as keyof typeof icons] ?? Tag,
      items: visibleActive.filter(item => (settings.assignments[item.id] ?? 'unsorted') === id),
    })).filter(group => !needle || group.items.length > 0)
  const editing = items.find(item => item.id === editingId)
  const reviewing = items.find(item => item.id === review?.id)

  const renderItem = (item: SomedayItem) => <div className={`sc-live-item${item.completedDate ? ' is-memory' : ''}`} key={item.id}>
    <SomedayPressButton review className="sc-live-item-main" item={item} completed={!!item.completedDate} onToggle={id => setReview({ id, details: false })} onEdit={id => setReview({ id, details: true })} interactionHintId={hintId}>
      <span className="sc-live-number" aria-hidden="true">{item.completedDate ? <Check /> : String(numbers.get(item.id)).padStart(2, '0')}</span>
      <span className="sc-live-copy"><strong>{item.title}</strong><small>
        {item.completedDate ? `Completed · ${formatCompletionDate(item.completedDate)}` : item.timing === 'beforeAge' ? `Before ${item.targetAge}` : 'Anytime'}
        <span> · {categoryName(item)} · {item.completedDate ? 'Created ' : ''}{formatCompletionDate(item.createdDate)}</span>
      </small></span>
      {item.description && <span className="sc-live-ellipsis" aria-label="Description available">…</span>}
    </SomedayPressButton>

  </div>

  return <div className="someday-shell someday-shell-cramble cramble-archive-shell sc-live mx-auto min-h-full w-full max-w-md px-5 pb-7 pt-6">
    <div className="cramble-decor-layer" aria-hidden="true" />
    <ProfileTopBar profile="cramble" onSettings={() => setManaging(true)} />
    <main className="someday-main relative z-10">
      <header className="someday-header">
        <div className="sc-live-heading"><h1 ref={headingRef} tabIndex={-1}>Someday</h1>
          <button type="button" className="sc-live-icon" aria-label="Search Someday" aria-expanded={searching} onClick={() => {
            setSearching(!searching); setQuery(''); if (!searching) setTimeout(() => searchRef.current?.focus(), 0)
          }}><Search aria-hidden="true" /></button>
        </div>
        <p>A quiet place for the life you want to live.</p>
        <div className="sc-live-summary"><strong>{active.length} {active.length === 1 ? 'thing' : 'things'} waiting</strong><span>{memories.length} memories made</span></div>
        <p id={hintId} className="sc-live-hint">Tap to review · Hold for details</p>
      </header>
      <div className="sc-live-tabs" role="group" aria-label="Group Someday items">
        <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>All</button>
        <button type="button" aria-pressed={view === 'category'} onClick={() => setView('category')}>Categories</button>
        <button type="button" aria-pressed={view === 'age'} onClick={() => setView('age')}>By age</button>
      </div>
      {searching && <div className="sc-live-search"><input ref={searchRef} type="search" value={query} placeholder="Find something…" aria-label="Search Someday items or categories" onChange={event => setQuery(event.target.value)} />
        <button type="button" onClick={() => { setSearching(false); setQuery('') }}>Cancel</button>
      </div>}
      {needle && <p className="sc-live-note" role="status">{visibleActive.length} waiting · {visibleMemories.length} memories match</p>}
      {view === 'all' && <div className="sc-live-items">{visibleActive.map(renderItem)}</div>}
      {view !== 'all' && groups.map(group => <details className="sc-live-group" key={`${view}-${group.key}-${!!needle}`} open={needle ? true : undefined}>
        <summary><group.Icon aria-hidden="true" /><span>{group.label}</span><small>{group.items.length} waiting</small><ChevronRight className="sc-live-caret" aria-hidden="true" /></summary>
        <div className="sc-live-items">{group.items.length ? group.items.map(renderItem) : <p className="sc-live-note">Nothing waiting here yet.</p>}</div>
      </details>)}
      {!visibleActive.length && view !== 'category' && <p className="sc-live-note">{needle ? 'No waiting items match.' : 'Your next possibility can begin here.'}</p>}
      <details className="sc-live-group sc-live-memories" key={`memories-${!!needle}`} open={needle ? true : undefined}>
        <summary><Sprout aria-hidden="true" /><span>Memories made</span><small>{needle ? visibleMemories.length : memories.length}</small><ChevronRight className="sc-live-caret" aria-hidden="true" /></summary>
        <div className="sc-live-items">{visibleMemories.length ? visibleMemories.map(renderItem) : <p className="sc-live-note">{needle ? 'No memories match.' : 'Your completed wishes will stay here.'}</p>}</div>
      </details>
      <button type="button" className="someday-add-button" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add something</button>
    </main>
    {(adding || editing) && <AddSomedayDialog profile="cramble" existingItems={items} item={editing} categories={settings.categories} categoryId={editing ? settings.assignments[editing.id] : null}
      onClose={() => { setAdding(false); setEditingId(null) }} onSubmit={onAdd} onUpdate={onUpdate} onDelete={onDelete} />}
    {reviewing && review && <SomedayReview item={reviewing} category={categoryName(reviewing)} details={review.details} onClose={() => setReview(null)} onEdit={() => { setReview(null); setEditingId(reviewing.id) }} onConfirm={() => { onToggle(reviewing.id); setReview(null) }} />}
    {managing && <SomedayCategorySettings items={items} settings={settings} onChange={onCategoryChange} onClose={() => setManaging(false)} />}
  </div>
}

function SomedayReview({ item, category, details, onClose, onEdit, onConfirm }: { item: SomedayItem; category: string; details: boolean; onClose: () => void; onEdit: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  return <dialog ref={ref} className="someday-dialog someday-dialog-cramble sc-review-dialog" aria-labelledby={headingId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="someday-dialog-panel">
      <div className="someday-dialog-heading"><div><p className="someday-dialog-eyebrow">{item.completedDate ? 'A memory made' : 'A life still unfolding'}</p><h2 id={headingId}>{item.title}</h2></div><button type="button" aria-label="Close details" onClick={onClose}><X aria-hidden="true" /></button></div>
      <p className="sc-review-meta">{item.timing === 'beforeAge' ? `Before ${item.targetAge}` : 'Anytime'} · {category} · <span aria-label={`Created ${formatCompletionDate(item.createdDate)}`}>{formatCompletionDate(item.createdDate)}</span></p>
      <p className="sc-review-description">{item.description || 'No description yet.'}</p>
      {item.completedDate && <p className="sc-live-note">Completed · {formatCompletionDate(item.completedDate)}</p>}
      {!details && <><h3>{item.completedDate ? 'Move this back to waiting?' : 'Mark this Someday as done?'}</h3><p className="sc-live-note">{item.completedDate ? 'This will remove its completion date.' : 'It will stay in Memories made with today’s date.'}</p></>}
      <div className="sc-review-actions"><button type="button" onClick={onClose}>{details ? 'Close' : item.completedDate ? 'Keep memory' : 'Not yet'}</button><button type="button" className="sc-review-primary" onClick={details ? onEdit : onConfirm}>{details ? 'Edit' : item.completedDate ? 'Move to waiting' : 'Yes, mark done'}</button></div>
    </div>
  </dialog>
}

function SomedayCategorySettings({ items, settings, onChange, onClose }: { items: SomedayItem[]; settings: SomedayCategories; onChange: Props['onCategoryChange']; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const headingId = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  const count = (id: string | null) => items.filter(item => (settings.assignments[item.id] ?? null) === id).length
  const apply = (change: SomedayCategoryChange) => {
    const message = onChange(change)
    setError(message)
    if (!message) { setEditing(null); setName(''); setDeleting(null); setNotice(change.type === 'delete' ? 'Category deleted. Its entries are now Unsorted.' : 'Category saved.') }
  }
  return <dialog ref={ref} className="someday-dialog someday-dialog-cramble sc-category-dialog" aria-labelledby={headingId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="someday-dialog-panel">
      <div className="someday-dialog-heading"><div><p className="someday-dialog-eyebrow">Settings</p><h2 id={headingId}>Someday categories</h2></div><button type="button" aria-label="Close category settings" onClick={onClose}><X aria-hidden="true" /></button></div>
      <p className="someday-dialog-intro">For wishes and memories only. Habit categories stay separate.</p>
      <form onSubmit={event => { event.preventDefault(); apply(editing ? { type: 'rename', id: editing, name } : { type: 'create', name }) }}>
        <label className="someday-field"><span>{editing ? 'Rename category' : 'New category'}</span><input aria-label="Category name" maxLength={40} required value={name} onChange={event => { setName(event.target.value); setError(null) }} /></label>
        <div className="sc-category-actions"><button type="submit">{editing ? 'Save name' : 'Create category'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName(''); setError(null) }}>Cancel</button>}</div>
      </form>
      {error && <p className="someday-dialog-error" role="alert">{error}</p>}
      <p className="sc-live-note" role="status">{notice || 'Counts include waiting items and completed memories.'}</p>
      <div className="sc-category-list">{Object.entries(settings.categories).map(([id, label]) => <div className="sc-category-row" key={id}>
        <div><strong>{label}</strong><small>{count(id)} entries</small></div>
        <button type="button" aria-label={`Rename ${label}`} onClick={() => { setEditing(id); setName(label); setDeleting(null); setError(null); ref.current?.querySelector<HTMLInputElement>('input')?.focus() }}>Rename</button>
        <button type="button" aria-label={`Delete ${label}`} onClick={() => { setDeleting(id); setError(null) }}>Delete</button>
        {deleting === id && <div className="sc-category-confirm" role="alert"><p>Delete “{label}”? Its {count(id)} entries will move to Unsorted. No wishes, memories, or dates will be deleted.</p><button type="button" onClick={() => apply({ type: 'delete', id })}>Delete category</button><button type="button" onClick={() => setDeleting(null)}>Keep category</button></div>}
      </div>)}</div>
      <p className="sc-live-note">Unsorted · {count(null)} entries. Always available.</p>
    </div>
  </dialog>
}
