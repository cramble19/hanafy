import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Activity, ArrowLeft, BookOpen, Ellipsis, Footprints, Heart, Pencil, Plus, Sprout, Star, Sun, Tag, Users, X } from 'lucide-react'
import type { GameState } from '@/types'
import { crambleQuests } from '@/data/crambleQuests'
import { getRhythmSettings, CATEGORY_NAME_LIMIT } from '@/lib/rhythmCategories'
import { categoryRecordedDays, getRhythmDates, getRhythmTrackers, recordedDays, sortRhythmTrackers, type RhythmRange, type RhythmTracker } from '@/lib/rhythmStats'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { CloudSyncNotice, type CloudSyncNoticeStatus } from '@/components/CloudSyncNotice'
import { downloadProfileJson } from '@/lib/habitExport'
import './rhythm.css'

type Props = {
  game: GameState
  onCreateCategory: (name: string) => { id: string | null; error: string | null }
  onAssignCategory: (habitId: string, categoryId: string | null) => string | null
  onToday: () => void; onObservatory: () => void; onSomeday: () => void; onLedger: () => void
  syncStatus: CloudSyncNoticeStatus; hasPendingSave: boolean; saveConfirmedAt: number | null; onRetry: () => void
}
const categoryIcons = { movement: Footprints, care: Heart, connection: Users, 'mind-play': BookOpen, unsorted: Ellipsis }
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function RhythmPage({ game, onCreateCategory, onAssignCategory, onToday, onObservatory, onSomeday, onLedger, syncStatus, hasPendingSave, saveConfirmedAt, onRetry }: Props) {
  const headingRef = usePageHeadingFocus()
  const [range, setRange] = useState<RhythmRange>(30)
  const [view, setView] = useState<'areas' | 'all'>('areas')
  const [area, setArea] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const trackers = useMemo(() => getRhythmTrackers(game, crambleQuests), [game])
  const rhythm = getRhythmSettings(game, trackers)
  const dates = getRhythmDates(game.currentDate, range)
  const categoryFor = (id: string) => rhythm.assignments[id] ?? 'unsorted'
  const categoryName = (id: string) => rhythm.categories[id] ?? 'Unsorted'
  const inArea = (id: string) => trackers.filter(item => categoryFor(item.id) === id)
  const categories = Object.keys(rhythm.categories).sort((a, b) =>
    categoryRecordedDays(inArea(b), dates).length - categoryRecordedDays(inArea(a), dates).length)
  const displayed = sortRhythmTrackers(area ? inArea(area) : trackers, dates)
  const editedTracker = trackers.find(item => item.id === editing)

  function trackerRow(item: RhythmTracker) {
    const recorded = recordedDays(item, dates)
    const isNew = item.created >= dates.at(-7)!
    return <li className="rhythm-task" key={item.id}>
      <div className="rhythm-between"><span className="rhythm-task-title">{item.title}{isNew && <span className="rhythm-new">New</span>}</span><span className="rhythm-total">{recorded.length} {recorded.length === 1 ? 'day' : 'days'}</span></div>
      <div className="rhythm-task-meta">
        <button type="button" className="rhythm-category-chip" onClick={() => setEditing(item.id)} aria-label={`Change category for ${item.title}`}>
          {categoryName(categoryFor(item.id))}<Pencil size={12} aria-hidden="true" />
        </button>
        {(item.paused || item.cadence !== 'Anytime' || item.observation) && <span>{item.paused ? 'Paused' : item.observation ? 'Check-in' : item.cadence}</span>}
      </div>
      <RhythmRibbon dates={dates} recorded={recorded} created={item.created} label={`${item.title}: ${recorded.length} recorded days in ${range} days`} />
    </li>
  }

  return <div className="rhythm-page">
    <div className="rhythm-brand">cramble</div>
    {area && <button type="button" className="rhythm-text-button" onClick={() => setArea(null)}><ArrowLeft size={17} aria-hidden="true" />Life areas</button>}
    <header className="rhythm-heading">
      <h1 ref={headingRef} tabIndex={-1}>{area ? categoryName(area) : 'Rhythm'}</h1>
      <div className="rhythm-range" aria-label="Record window">{([7, 30] as const).map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}d</button>)}</div>
    </header>
    {!area && <div className="rhythm-tabs" aria-label="Rhythm view">
      <button type="button" aria-pressed={view === 'areas'} onClick={() => setView('areas')}>Life areas</button>
      <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>All habits · {trackers.length}</button>
    </div>}
    <p className="rhythm-date-range">{dateLabel(dates[0])} – {dateLabel(game.currentDate)}</p>
    <main>
      {!area && view === 'areas' ? <>
        <div className="rhythm-between rhythm-toolbar"><span>{categories.length} categories</span><button type="button" className="rhythm-text-button" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" />New category</button></div>
        {[...categories, 'unsorted'].map(id => {
          const members = inArea(id), recorded = categoryRecordedDays(members, dates)
          const Icon = categoryIcons[id as keyof typeof categoryIcons] ?? Tag
          return <button type="button" className="rhythm-area" key={id} onClick={() => setArea(id)} aria-label={`Open ${categoryName(id)}`}>
            <span className="rhythm-area-icon"><Icon size={23} aria-hidden="true" /></span>
            <span className="rhythm-area-content"><span className="rhythm-between"><span className="rhythm-area-name">{categoryName(id)}</span><span className="rhythm-total">{recorded.length} / {range} days</span></span>
              <span className="rhythm-area-meta">{members.length} {members.length === 1 ? 'tracker' : 'trackers'}</span>
              <RhythmRibbon dates={dates} recorded={recorded} label={`${categoryName(id)}: at least one record on ${recorded.length} days`} />
            </span>
          </button>
        })}
      </> : <>
        <p className="rhythm-list-label">{displayed.length} {displayed.length === 1 ? 'tracker' : 'trackers'} · Most recorded first</p>
        <ul className="rhythm-list">{displayed.map(trackerRow)}</ul>
        {!displayed.length && <div className="rhythm-empty"><p>{area ? 'No tasks here yet.' : 'Your habits will appear here when you add them.'}</p>{area && <button type="button" className="rhythm-secondary" onClick={() => { setArea(null); setView('all') }}>Choose from all habits</button>}</div>}
      </>}
    </main>
    <p className="rhythm-status" role="status">{announcement}</p>
    <p className="rhythm-footnote">Days with a record, not a success score. Blank days stay neutral.</p>
    <nav className="rhythm-bottom-nav" aria-label="Cramble navigation">
      {([{ label: 'Today', icon: Sun, action: onToday }, { label: 'Observatory', icon: Sprout, action: onObservatory }, { label: 'Someday', icon: Star, action: onSomeday }, { label: 'Rhythm', icon: Activity }, { label: 'Ledger', icon: BookOpen, action: onLedger }]).map(({ label, icon: Icon, action }) => <button type="button" key={label} onClick={action} aria-current={label === 'Rhythm' ? 'page' : undefined}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>)}
    </nav>
    <CloudSyncNotice profile="cramble" status={syncStatus} hasPendingSave={hasPendingSave} saveConfirmedAt={saveConfirmedAt} onRetry={onRetry} onExportBackup={() => downloadProfileJson(game, crambleQuests, 'cramble')} />
    {(editing === 'new' || editedTracker) && <CategoryDialog
      key={editing} title={editedTracker?.title ?? null} categories={rhythm.categories}
      current={editedTracker ? rhythm.assignments[editedTracker.id] ?? null : null}
      onClose={() => setEditing(null)} onCreate={onCreateCategory}
      onSave={categoryId => {
        if (!editedTracker) return 'This task is no longer available.'
        const error = onAssignCategory(editedTracker.id, categoryId)
        if (!error) setAnnouncement(`${editedTracker.title} moved to ${categoryId ? categoryName(categoryId) : 'Unsorted'}.`)
        return error
      }} />}
  </div>
}

function RhythmRibbon({ dates, recorded, label, created }: { dates: string[]; recorded: string[]; label: string; created?: string }) {
  const marked = new Set(recorded)
  return <span className="rhythm-ribbon" role="img" aria-label={label} style={{ '--rhythm-days': dates.length } as CSSProperties}>{dates.map((date, i) => <span key={date} className={`${marked.has(date) ? 'is-recorded' : ''} ${!marked.has(dates[i - 1]) ? 'is-start' : ''} ${!marked.has(dates[i + 1]) ? 'is-end' : ''} ${created && date < created ? 'before-created' : ''}`} />)}</span>
}

function CategoryDialog({ title, current, categories, onClose, onCreate, onSave }: {
  title: string | null; current: string | null; categories: Record<string, string>; onClose: () => void
  onCreate: Props['onCreateCategory']; onSave: (category: string | null) => string | null
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState(current)
  const [creating, setCreating] = useState(!title)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const dialog = dialogRef.current!
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  useEffect(() => { if (creating) inputRef.current?.focus() }, [creating])
  function create() {
    const result = onCreate(name)
    if (result.error || !result.id) { setError(result.error); return }
    if (!title) { onClose(); return }
    setSelected(result.id); setCreating(false); setName(''); setError(null)
  }
  return <dialog className="rhythm-dialog" ref={dialogRef} aria-labelledby="rhythm-category-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="rhythm-between"><div><p className="rhythm-eyebrow">{title ? 'Change category' : 'Life areas'}</p><h2 id="rhythm-category-title">{title ?? 'New category'}</h2></div><button type="button" className="rhythm-close" onClick={onClose} aria-label="Close category editor"><X size={18} aria-hidden="true" /></button></div>
    {title && <><p className="rhythm-dialog-note">Choose a life area. Past records stay with this task.</p><fieldset><legend>Category</legend>{[...Object.entries(categories), ['unsorted', 'Unsorted']].map(([id, label]) => <label className="rhythm-option" key={id}><input type="radio" name="rhythm-category" value={id} checked={(selected ?? 'unsorted') === id} onChange={() => { setSelected(id === 'unsorted' ? null : id); setError(null) }} />{label}</label>)}</fieldset></>}
    {creating ? <form className="rhythm-create" onSubmit={event => { event.preventDefault(); create() }}><label htmlFor="rhythm-category-name">Category name</label><input id="rhythm-category-name" ref={inputRef} value={name} maxLength={CATEGORY_NAME_LIMIT} placeholder="e.g. Learning" onChange={event => { setName(event.target.value); setError(null) }} aria-invalid={!!error} aria-describedby={error ? 'rhythm-category-error' : undefined} /><div className="rhythm-between"><button type="button" className="rhythm-text-button" onClick={() => { if (!title) onClose(); else { setCreating(false); setError(null) } }}>Cancel</button><button className="rhythm-primary" type="submit">{title ? 'Create & select' : 'Create category'}</button></div></form> : <button type="button" className="rhythm-text-button" onClick={() => { setCreating(true); setError(null) }}><Plus size={16} aria-hidden="true" />New category</button>}
    {error && <p id="rhythm-category-error" className="rhythm-error" role="alert">{error}</p>}
    {title && <div className="rhythm-dialog-actions"><button type="button" className="rhythm-secondary" onClick={onClose}>Cancel</button><button type="button" className="rhythm-primary" disabled={creating} onClick={() => { const issue = onSave(selected); if (issue) setError(issue); else onClose() }}>Save category</button></div>}
  </dialog>
}
