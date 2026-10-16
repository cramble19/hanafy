import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getRollingEmotionHistory, type EmotionHistoryRange } from '@/lib/emotionHistory'
import { smoothProgressPath } from '@/lib/rhythmProgress'
import { DAILY_EMOTION_LABELS } from '@/lib/dailyEmotions'
import type { GameState } from '@/types'
import './emotion-trend.css'

const labels = ['Bright', 'Good', 'Okay', 'Low', 'Heavy']
const y = (value: number) => 24 + (5 - value) * 42
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fullDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

/** Separate paths preserve actual gaps; interpolation never manufactures observations. */
export function emotionCurveRuns(values: Array<number | null>, spacing: number) {
  const runs: Array<Array<{ x: number; y: number }>> = []
  values.forEach((value, index) => {
    if (value === null) return
    const point = { x: spacing * (index + .5), y: y(value) }
    if (index && values[index - 1] !== null) runs.at(-1)!.push(point)
    else runs.push([point])
  })
  return runs
}

export function EmotionTrendChart({ game, range }: { game: GameState; range: EmotionHistoryRange }) {
  const days = useMemo(() => getRollingEmotionHistory(game, range), [game, range])
  const scroller = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState(280)
  const [left, setLeft] = useState(0)
  const [selectedDate, setSelectedDate] = useState(game.currentDate)
  const spacing = range === 7 ? viewport / Math.max(1, days.length) : 44
  const width = Math.max(viewport, days.length * spacing)
  const selected = days.find(day => day.dateKey === selectedDate) ?? days.at(-1)
  const selectedIndex = selected ? days.indexOf(selected) : -1
  const daily = emotionCurveRuns(days.map(day => day.value), spacing)
  const average = emotionCurveRuns(days.map(day => day.average), spacing)
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewport(element.clientWidth))
    setViewport(element.clientWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (scroller.current) { scroller.current.scrollLeft = width; setLeft(scroller.current.scrollLeft) }
  }, [width, range])
  const firstVisible = Math.max(0, Math.min(days.length - 1, Math.floor(left / spacing)))
  const lastVisible = Math.max(0, Math.min(days.length - 1, Math.floor((left + viewport - 1) / spacing)))
  const scroll = (direction: number) => scroller.current?.scrollBy({ left: direction * viewport * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  return <div className="emotion-trend">
    <div className="emotion-trend-legend"><span><i />Daily mood</span><span><i className="is-average" />{range}-day average</span></div>
    <div className="emotion-trend-row">
      <div className="emotion-trend-axis" aria-hidden="true">{labels.map((label, index) => <span key={label} style={{ top: 24 + index * 42 }}>{label}</span>)}</div>
      <div ref={scroller} className="emotion-trend-scroll" role="region" aria-label={`Scrollable ${range}-day emotion chart`} onScroll={event => setLeft(event.currentTarget.scrollLeft)}>
        <div style={{ width }}>
          <svg width={width} height={222} viewBox={`0 0 ${width} 222`} role="img" aria-label={`Daily moods and trailing ${range}-day average. Bright at top, Heavy at bottom. Select a date below for details.`}>
            {labels.map((label, index) => <line key={label} x1={0} x2={width} y1={24 + index * 42} y2={24 + index * 42} className="emotion-trend-grid" />)}
            {daily.map((run, index) => <path key={index} d={smoothProgressPath(run)} className="emotion-trend-daily" />)}
            {average.map((run, index) => <g key={index}><path d={smoothProgressPath(run)} className="emotion-trend-average" />{run.length === 1 && <circle cx={run[0].x} cy={run[0].y} r={3} className="emotion-trend-average-dot" />}</g>)}
            {days.map((day, index) => day.value !== null && <circle key={day.dateKey} cx={spacing * (index + .5)} cy={y(day.value)} r={3} className="emotion-trend-dot"><title>{fullDate(day.dateKey)}: {DAILY_EMOTION_LABELS[day.emotion!]}</title></circle>)}
            {selected && selectedIndex >= 0 && <>
              {selected.value !== null && <circle cx={spacing * (selectedIndex + .5)} cy={y(selected.value)} r={5.5} className="emotion-trend-selected" />}
              {selected.average !== null && <circle cx={spacing * (selectedIndex + .5)} cy={y(selected.average)} r={4} className="emotion-trend-selected is-average" />}
            </>}
          </svg>
          <div className="emotion-trend-dates">{days.map(day => <button type="button" key={day.dateKey} style={{ width: spacing }} aria-label={`Inspect ${fullDate(day.dateKey)}`} aria-pressed={selected?.dateKey === day.dateKey} onClick={() => setSelectedDate(day.dateKey)}><span>{new Date(`${day.dateKey}T12:00:00`).getDate()}</span><small>{new Date(`${day.dateKey}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</small></button>)}</div>
        </div>
      </div>
    </div>
    {days.length > 0 && <div className="emotion-trend-scroll-controls">
      <button type="button" aria-label="Scroll to earlier mood dates" disabled={left <= 1} onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
      <span>{shortDate(days[firstVisible].dateKey)} – {shortDate(days[lastVisible].dateKey)}{width > viewport ? ' · swipe' : ''}</span>
      <button type="button" aria-label="Scroll to later mood dates" disabled={left + viewport >= width - 1} onClick={() => scroll(1)}><ChevronRight size={18} /></button>
    </div>}
    {selected && <div className="emotion-trend-detail" aria-live="polite"><p>{fullDate(selected.dateKey)} · {selected.emotion ? DAILY_EMOTION_LABELS[selected.emotion] : 'Not recorded'}</p><p>{range}-day average: {selected.average === null ? 'No records in this window' : `${selected.average.toFixed(1)}/5 · ${selected.count} recorded ${selected.count === 1 ? 'day' : 'days'}`}</p></div>}
    <p className="emotion-trend-note">Average uses recorded moods in the preceding {range} days, including each date. Missing days aren’t zero. Daily gaps stay visible.</p>
    {!days.some(day => day.value !== null || day.average !== null) && <p className="emotion-history-empty">No moods recorded yet in these windows.</p>}
  </div>
}
