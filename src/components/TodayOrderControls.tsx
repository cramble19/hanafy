import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { useRef } from 'react'
import type { TodayOrder } from '@/lib/todayOrder'

export function OrderButtons({ id, ids, onOrder }: { id: string; ids: string[]; onOrder: (ids: string[]) => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const index = ids.indexOf(id)
  function move(target: string) {
    const to = ids.indexOf(target)
    if (to < 0 || to === index) return
    const next = [...ids]; next.splice(index, 1); next.splice(to, 0, id); onOrder(next)
  }
  return <span className="today-order-buttons">
    <button type="button" aria-label="Drag to reorder" style={{ touchAction: 'none' }} onPointerDown={event => {
      start.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerCancel={() => { start.current = null }} onPointerUp={event => {
      const initial = start.current; start.current = null
      if (!initial || Math.hypot(event.clientX - initial.x, event.clientY - initial.y) < 8) return
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-order-id]')
      if (target?.dataset.orderId) move(target.dataset.orderId)
    }}><GripVertical size={16} aria-hidden="true" /></button>
    <button type="button" aria-label="Move up" disabled={index <= 0} onClick={() => move(ids[index - 1])}><ArrowUp size={16} aria-hidden="true" /></button>
    <button type="button" aria-label="Move down" disabled={index === ids.length - 1} onClick={() => move(ids[index + 1])}><ArrowDown size={16} aria-hidden="true" /></button>
  </span>
}

export function TodaySortSelect({ value, onChange }: { value: TodayOrder['sort']; onChange: (sort: TodayOrder['sort']) => void }) {
  return <label className="someday-field"><span>Sort Today habits</span><select value={value} onChange={event => onChange(event.target.value as TodayOrder['sort'])}>
    <option value="groups">By groups</option><option value="manual">Manual order</option><option value="7">Frequency · 7 days</option><option value="30">Frequency · 30 days</option>
  </select></label>
}
