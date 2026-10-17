import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ProfileTopBar } from '@/components/ProfileTopBar'
import { usePageHeadingFocus } from '@/hooks/usePageHeadingFocus'
import { lifetimeTotal, type LifetimeChange } from '@/lib/lifetime'
import type { LifetimeCounter } from '@/types'
import './lifetime.css'

type Props = { counters: LifetimeCounter[]; today: string; onChange: (change: LifetimeChange) => string | null }
export function LifetimePage({ counters, today, onChange }: Props) {
  const heading = usePageHeadingFocus()
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [undo, setUndo] = useState<{ id: string; entryId: string } | null>(null)
  const counter = counters.find(item => item.id === selected)
  function record(item: LifetimeCounter) {
    const entryId = crypto.randomUUID()
    const error = onChange({ type: 'record', id: item.id, date: today, entryId })
    setNotice(error ?? `One occurrence recorded for ${item.title}.`)
    if (!error) setUndo({ id: item.id, entryId })
  }
  return <div className="cramble-archive-shell rhythm-page lifetime-page">
    <ProfileTopBar profile="cramble" />
    <header className="rhythm-heading"><h1 ref={heading} tabIndex={-1}>Lifetime</h1></header>
    <p className="lifetime-subtitle">A quiet record of your life.</p>
    <main>
      {counters.length === 0 && <div className="lifetime-empty"><h2>Keep a lifetime tally</h2><p>Create a counter for something you want to keep track of. Start at zero, or enter an earlier total.</p></div>}
      {counters.map(item => {
        const lastDate = item.entries.reduce<string | null>((latest, entry) => !latest || entry.date > latest ? entry.date : latest, null)
        return <article className="lifetime-card" key={item.id}>
          <button type="button" className="lifetime-card-open" aria-label={`View details and edit ${item.title}`} onClick={() => setSelected(item.id)}>
            <span className="lifetime-card-title">{item.title}</span>
            <span className="lifetime-card-meta">{lastDate ? `Last recorded · ${new Date(lastDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No dated records yet'}</span>
            <span className="lifetime-card-total">{lifetimeTotal(item).toLocaleString()}<small>times</small></span>
          </button>
          <button type="button" className="lifetime-plus" aria-label={`Record one occurrence of ${item.title}`} onClick={() => record(item)}><Plus aria-hidden="true" /></button>
        </article>
      })}
      <div className="lifetime-notice" aria-live="polite">{notice}{undo?.entryId && <button className="lifetime-text-button" onClick={() => { const error = onChange({ type: 'undo', ...undo }); setNotice(error ?? 'Last record undone.'); if (!error) setUndo(null) }}>Undo</button>}</div>
      <button type="button" className="lifetime-add" onClick={() => setSelected('new')}><Plus size={18} aria-hidden="true" />Add counter</button>
    </main>
    {selected && (selected === 'new' || counter) && <CounterDialog key={selected} counter={counter} today={today} onChange={onChange} onClose={() => setSelected(null)} />}
  </div>
}

function CounterDialog({ counter, today, onChange, onClose }: { counter?: LifetimeCounter; today: string; onChange: Props['onChange']; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(!counter)
  const [title, setTitle] = useState(counter?.title ?? '')
  const [description, setDescription] = useState(counter?.description ?? '')
  const [startingTotal, setStartingTotal] = useState(String(counter?.startingTotal ?? 0))
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.showModal()
    return () => { document.body.style.overflow = overflow; opener?.focus() }
  }, [])
  return <dialog ref={ref} className="add-habit-dialog add-habit-dialog-cramble lifetime-dialog" aria-label={counter ? 'Counter details' : 'Add counter'} onCancel={onClose}>
    <div className="lifetime-dialog-heading"><h2>{editing ? counter ? 'Edit counter' : 'Add counter' : counter?.title}</h2><button type="button" aria-label="Close counter" onClick={onClose}><X /></button></div>
    {editing ? <form onSubmit={event => { event.preventDefault(); const result = onChange({ type: 'save', id: counter?.id, title, description, startingTotal: startingTotal === '' ? NaN : Number(startingTotal) }); setError(result); if (!result) { if (counter) setEditing(false); else onClose() } }}>
      <label>Name<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Times I drank alcohol" /></label>
      <label>Description<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="What counts as one occurrence?" /></label>
      <label>Starting total<input required type="number" min="0" max="1000000000" step="1" value={startingTotal} onChange={event => setStartingTotal(event.target.value)} /></label>
      <p className="lifetime-subtitle">Earlier occurrences, before your dated records. Changing this does not erase recorded dates.</p>
      <button className="lifetime-save" type="submit">Save counter</button>
    </form> : counter && <>
      <p className="lifetime-value">{lifetimeTotal(counter).toLocaleString()}<small>times</small></p>
      {counter.description && <p className="lifetime-description">{counter.description}</p>}
      <button className="lifetime-text-button" onClick={() => setEditing(true)}>Edit name, description or starting total</button>
      <form onSubmit={event => { event.preventDefault(); setError(onChange({ type: 'record', id: counter.id, date })) }}><label>Record an occurrence<input type="date" required max={today} value={date} onChange={event => setDate(event.target.value)} /></label><button className="lifetime-save" type="submit">Record +1</button></form>
      <h3>History</h3><p className="lifetime-subtitle">Starting total: {counter.startingTotal} · dates unknown</p>
      <ul className="lifetime-history">{[...counter.entries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => <li key={entry.id}><span>{new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · +{entry.amount}</span>{removeId === entry.id ? <span><button className="lifetime-text-button" onClick={() => { setError(onChange({ type: 'undo', id: counter.id, entryId: entry.id })); setRemoveId(null) }}>Confirm removal</button><button className="lifetime-text-button" onClick={() => setRemoveId(null)}>Cancel</button></span> : <button className="lifetime-text-button" aria-label={`Remove record from ${entry.date}`} onClick={() => setRemoveId(entry.id)}>Remove</button>}</li>)}</ul>
    </>}
    {error && <p role="alert">{error}</p>}
  </dialog>
}
