import { createContext, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import type { RhythmSettings } from '@/types'
import type { SomedayCategoryChange } from '@/lib/somedayCategories'
import '@/pages/someday-categories.css'
import { defaultTodayOrder, orderedIds, type TodayOrder } from '@/lib/todayOrder'
import { OrderButtons, TodaySortSelect } from './TodayOrderControls'
import './today-order.css'

export const CrambleSettingsContext = createContext<(() => void) | undefined>(undefined)
export const CrambleSharedSyncContext = createContext(false)

type Props = {
  habits: RhythmSettings; someday: RhythmSettings
  habitIds: string[]; somedayIds: string[]
  onHabitChange: (change: SomedayCategoryChange) => string | null
  onSomedayChange: (change: SomedayCategoryChange) => string | null
  onClose: () => void
  habitTitles?: Record<string, string>
  onTodayOrderChange?: (order: TodayOrder) => void
}
export function CrambleSettings({ habits, someday, habitIds, somedayIds, onHabitChange, onSomedayChange, onClose, habitTitles = {}, onTodayOrderChange }: Props) {
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
  const today = habits.today ?? defaultTodayOrder
  const groupIds = orderedIds(Object.keys(settings.categories), section === 'habits' ? today.groupOrder : [])
  const manualIds = orderedIds(habitIds, today.habitOrder)
  const reorder = (field: 'groupOrder' | 'habitOrder', order: string[]) => {
    onTodayOrderChange?.({ ...today, [field]: order }); setNotice('Order saved.')
  }
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
      <div className="someday-dialog-heading"><h2 id={headingId}>{section ? section === 'habits' ? 'Today settings' : 'Someday categories' : 'Settings'}</h2><button type="button" aria-label="Close settings" onClick={onClose}><X aria-hidden="true" /></button></div>
      {!section ? <div className="cramble-settings-sections">{(['habits', 'someday'] as const).map(value => <button type="button" key={value} onClick={() => changeSection(value)}>{value === 'habits' ? 'Today · sorting & groups' : 'Someday categories'}<ChevronRight size={18} aria-hidden="true" /></button>)}</div> : <>
        <button type="button" className="rhythm-text-button" onClick={() => changeSection(null)}><ArrowLeft size={16} aria-hidden="true" />Settings</button>
        <p className="someday-dialog-intro">{section === 'habits' ? 'Groups are shared with Rhythm. Your records stay unchanged.' : 'For Somedays and completed memories only. Habit categories stay separate.'}</p>
        {section === 'habits' && onTodayOrderChange && <>
          <TodaySortSelect value={today.sort} onChange={sort => onTodayOrderChange({ ...today, sort })} />
          <p className="sc-live-note">{today.sort === '7' || today.sort === '30' ? 'Most recorded days first, not repetitions. Ties use your manual order.' : 'Drag a handle or use the arrows to reorder. Unsorted stays last.'}</p>
          {today.sort === 'manual' && <div className="sc-category-list" aria-label="Manual habit order">{manualIds.map(id => <div className="sc-category-row" data-order-id={id} key={id} role="group" aria-label={habitTitles[id] ?? id}><div>{habitTitles[id] ?? id}</div><OrderButtons id={id} ids={manualIds} onOrder={order => reorder('habitOrder', order)} /></div>)}</div>}
          <h3>Groups</h3>
        </>}
        <form onSubmit={event => { event.preventDefault(); apply(editing ? { type: 'rename', id: editing, name } : { type: 'create', name }) }}>
          <label className="someday-field"><span>{editing ? 'Rename category' : 'New category'}</span><input aria-label="Category name" maxLength={40} required value={name} onChange={event => { setName(event.target.value); setError(null) }} /></label>
          <div className="sc-category-actions"><button type="submit">{editing ? 'Save name' : 'Create category'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName(''); setError(null) }}>Cancel</button>}</div>
        </form>
        {error && <p role="alert" className="someday-dialog-error">{error}</p>}
        <p role="status" className="sc-live-note">{notice}</p>
        <div className="sc-category-list">{groupIds.map(id => { const title = settings.categories[id]; return <div className="sc-category-row" key={id} data-order-id={id} role="group" aria-label={title}>
          <div><strong>{title}</strong><small>{count(id)} items</small></div>
          {section === 'habits' && onTodayOrderChange && <OrderButtons id={id} ids={groupIds} onOrder={order => reorder('groupOrder', order)} />}
          <button type="button" aria-label={`Rename ${title}`} onClick={() => { setEditing(id); setName(title); setDeleting(null); setError(null); ref.current?.querySelector('input')?.focus() }}>Rename</button>
          <button type="button" aria-label={`Delete ${title}`} onClick={() => { setDeleting(id); setError(null) }}>Delete</button>
          {deleting === id && <div className="sc-category-confirm" role="alert"><p>Delete “{title}”? Its {count(id)} items will move to Unsorted. No items, records, or dates will be deleted.</p><button type="button" onClick={() => apply({ type: 'delete', id })}>Delete category</button><button type="button" onClick={() => setDeleting(null)}>Keep category</button></div>}
        </div> })}</div>
        <p className="sc-live-note">Unsorted · {count(null)} items. Always available.</p>
      </>}
    </div>
  </dialog>
}
