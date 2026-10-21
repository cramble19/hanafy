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
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState('')
  const [undo, setUndo] = useState<{ id: string; entryId: string } | null>(null)
  const counter = counters.find(item => item.id === selected)
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
          <button type="button" className="lifetime-plus" aria-label={`Record one occurrence of ${item.title}`} onClick={() => { setRecording(true); setSelected(item.id) }}><Plus aria-hidden="true" /></button>
        </article>
      })}
      <div className="lifetime-notice" aria-live="polite">{notice}{undo?.entryId && <button className="lifetime-text-button" onClick={() => { const error = onChange({ type: 'undo', ...undo }); setNotice(error ?? 'Last record undone.'); if (!error) setUndo(null) }}>Undo</button>}</div>
      <button type="button" className="lifetime-add" onClick={() => setSelected('new')}><Plus size={18} aria-hidden="true" />Add counter</button>
    </main>
    {selected && (selected === 'new' || counter) && <CounterDialog key={selected} counter={counter} today={today} initialRecording={recording} onRecorded={(id, entryId) => { setUndo({ id, entryId }); setNotice('Occurrence recorded.') }} onChange={onChange} onClose={() => { setSelected(null); setRecording(false) }} />}
  </div>
}

export function CounterDialog({ counter, today, onChange, onClose, initialRecording = false, onRecorded }: { counter?: LifetimeCounter; today: string; onChange: Props['onChange']; onClose: () => void; initialRecording?: boolean; onRecorded?: (id: string, entryId: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(!counter)
  const [recording, setRecording] = useState(initialRecording)
  const [note, setNote] = useState('')
  const entryId = useRef(crypto.randomUUID())
  const [title, setTitle] = useState(counter?.title ?? '')
  const [description, setDescription] = useState(counter?.description ?? '')
  const [startingTotal, setStartingTotal] = useState(String(counter?.startingTotal ?? 0))
  const [startingDescription, setStartingDescription] = useState(counter?.startingDescription ?? '')
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
    <div className="lifetime-dialog-heading"><h2>{recording ? 'Record occurrence' : editing ? counter ? 'Edit counter' : 'Add counter' : counter?.title}</h2><button type="button" aria-label="Close counter" onClick={onClose}><X /></button></div>
    {recording && counter ? <form onSubmit={event => {
      event.preventDefault()
      const result = onChange({ type: 'record', id: counter.id, date, note, entryId: entryId.current })
      setError(result)
      if (!result) { onRecorded?.(counter.id, entryId.current); setRecording(false); setNote(''); entryId.current = crypto.randomUUID() }
    }}>
      <p className="lifetime-subtitle">{counter.title}</p>
      <label>Date<input type="date" required max={today} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>What prompted it? · optional<textarea maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="An occasion, a feeling, or a little context…" /></label>
      <p className="lifetime-subtitle">Up to 2,000 characters.</p>
      <div className="lifetime-record-actions"><button type="button" className="lifetime-text-button" onClick={() => { setRecording(false); setNote(''); setError(null) }}>Cancel</button><button className="lifetime-save" type="submit">Save +1</button></div>
    </form> : editing ? <form onSubmit={event => { event.preventDefault(); const result = onChange({ type: 'save', id: counter?.id, title, description, startingDescription, startingTotal: startingTotal === '' ? NaN : Number(startingTotal) }); setError(result); if (!result) { if (counter) setEditing(false); else onClose() } }}>
      <label>Name<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Times I drank alcohol" /></label>
      <label>Description<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="What counts as one occurrence?" /></label>
      <label>Starting total<input required type="number" min="0" max="1000000000" step="1" value={startingTotal} onChange={event => setStartingTotal(event.target.value)} /></label>
      <p className="lifetime-subtitle">Earlier occurrences, before your dated records. Changing this does not erase recorded dates.</p>
      <label>Starting-total description · optional<textarea maxLength={2000} value={startingDescription} onChange={event => setStartingDescription(event.target.value)} placeholder="Context for your earlier total, before tracking began…" /></label>
      <button className="lifetime-save" type="submit">Save counter</button>
    </form> : counter && <>
      <p className="lifetime-value">{lifetimeTotal(counter).toLocaleString()}<small>times</small></p>
      {counter.description && <p className="lifetime-description">{counter.description}</p>}
      <button className="lifetime-text-button" onClick={() => setEditing(true)}>Edit name, description or starting total</button>
      <button className="lifetime-save" type="button" onClick={() => { setRecording(true); setError(null) }}>Record +1</button>
      <h3>History</h3><p className="lifetime-subtitle">Starting total: {counter.startingTotal} · dates unknown</p>
      {counter.startingDescription && <p className="lifetime-description">{counter.startingDescription}</p>}
      <ul className="lifetime-history">{[...counter.entries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => <li key={entry.id}>
        <div className="lifetime-entry-context"><span>{new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · +{entry.amount}</span>{entry.note && <p className="lifetime-description">{entry.note}</p>}</div>
        {removeId === entry.id ? <span><button className="lifetime-text-button" onClick={() => { setError(onChange({ type: 'undo', id: counter.id, entryId: entry.id })); setRemoveId(null) }}>Confirm removal</button><button className="lifetime-text-button" onClick={() => setRemoveId(null)}>Cancel</button></span> : <button className="lifetime-text-button" aria-label={`Remove record from ${entry.date}`} onClick={() => setRemoveId(entry.id)}>Remove</button>}
      </li>)}</ul>
    </>}
    {error && <p role="alert">{error}</p>}
  </dialog>
}
