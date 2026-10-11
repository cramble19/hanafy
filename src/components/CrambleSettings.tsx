import { createContext, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import type { RhythmSettings } from '@/types'
import type { SomedayCategoryChange } from '@/lib/somedayCategories'
import '@/pages/someday-categories.css'

export const CrambleSettingsContext = createContext<(() => void) | undefined>(undefined)
export const CrambleSharedSyncContext = createContext(false)

type Props = {
  habits: RhythmSettings; someday: RhythmSettings
  habitIds: string[]; somedayIds: string[]
  onHabitChange: (change: SomedayCategoryChange) => string | null
  onSomedayChange: (change: SomedayCategoryChange) => string | null
  onClose: () => void
}
export function CrambleSettings({ habits, someday, habitIds, somedayIds, onHabitChange, onSomedayChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null), headingId = useId()
  const [section, setSection] = useState<'habits' | 'someday' | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow, dialog = ref.current!
    dialog.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  const settings = section === 'habits' ? habits : someday
  const ids = section === 'habits' ? habitIds : somedayIds
  const count = (id: string | null) => ids.filter(item => (settings.assignments[item] ?? null) === id).length
  function changeSection(value: typeof section) { setSection(value); setEditing(null); setName(''); setDeleting(null); setError(null); setNotice('') }
  function apply(change: SomedayCategoryChange) {
    const issue = (section === 'habits' ? onHabitChange : onSomedayChange)(change)
    setError(issue)
    if (!issue) { setEditing(null); setName(''); setDeleting(null); setNotice(change.type === 'delete' ? 'Category deleted. Its items are now Unsorted.' : 'Category saved.') }
  }
  return <dialog ref={ref} className="someday-dialog someday-dialog-cramble sc-category-dialog" aria-labelledby={headingId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="someday-dialog-panel">
      <div className="someday-dialog-heading"><h2 id={headingId}>{section ? section === 'habits' ? 'Habit categories' : 'Someday categories' : 'Settings'}</h2><button type="button" aria-label="Close settings" onClick={onClose}><X aria-hidden="true" /></button></div>
      {!section ? <div className="cramble-settings-sections">{(['habits', 'someday'] as const).map(value => <button type="button" key={value} onClick={() => changeSection(value)}>{value === 'habits' ? 'Habit categories' : 'Someday categories'}<ChevronRight size={18} aria-hidden="true" /></button>)}</div> : <>
        <button type="button" className="rhythm-text-button" onClick={() => changeSection(null)}><ArrowLeft size={16} aria-hidden="true" />Settings</button>
        <p className="someday-dialog-intro">{section === 'habits' ? 'For habits only. Observatory lessons and Somedays stay separate.' : 'For Somedays and completed memories only. Habit categories stay separate.'}</p>
        <form onSubmit={event => { event.preventDefault(); apply(editing ? { type: 'rename', id: editing, name } : { type: 'create', name }) }}>
          <label className="someday-field"><span>{editing ? 'Rename category' : 'New category'}</span><input aria-label="Category name" maxLength={40} required value={name} onChange={event => { setName(event.target.value); setError(null) }} /></label>
          <div className="sc-category-actions"><button type="submit">{editing ? 'Save name' : 'Create category'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName(''); setError(null) }}>Cancel</button>}</div>
        </form>
        {error && <p role="alert" className="someday-dialog-error">{error}</p>}
        <p role="status" className="sc-live-note">{notice}</p>
        <div className="sc-category-list">{Object.entries(settings.categories).map(([id, title]) => <div className="sc-category-row" key={id}>
          <div><strong>{title}</strong><small>{count(id)} items</small></div>
          <button type="button" aria-label={`Rename ${title}`} onClick={() => { setEditing(id); setName(title); setDeleting(null); setError(null); ref.current?.querySelector('input')?.focus() }}>Rename</button>
          <button type="button" aria-label={`Delete ${title}`} onClick={() => { setDeleting(id); setError(null) }}>Delete</button>
          {deleting === id && <div className="sc-category-confirm" role="alert"><p>Delete “{title}”? Its {count(id)} items will move to Unsorted. No items, records, or dates will be deleted.</p><button type="button" onClick={() => apply({ type: 'delete', id })}>Delete category</button><button type="button" onClick={() => setDeleting(null)}>Keep category</button></div>}
        </div>)}</div>
        <p className="sc-live-note">Unsorted · {count(null)} items. Always available.</p>
      </>}
    </div>
  </dialog>
}
