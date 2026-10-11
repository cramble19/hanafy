import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { addDays } from '@/lib/hanaGame'
import { getRhythmProgress, smoothProgressPath, type ProgressDay, type ProgressRange } from '@/lib/rhythmProgress'
import type { RhythmTracker } from '@/lib/rhythmStats'
import './rhythm-progress.css'

const label = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function RhythmProgress({ tracker, end, onBack }: { tracker: RhythmTracker; end: string; onBack: () => void }) {
  const [range, setRange] = useState<ProgressRange>(30)
  const [selected, setSelected] = useState<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const days = getRhythmProgress(tracker, end, range)
  const current = selected === null ? days.at(-1)! : days[Math.min(selected, days.length - 1)]
  const baseline = { date: addDays(days[0].date, -1), cumulative: 0, recent: 0, recorded: false }
  return <main className="rhythm-progress">
    <button type="button" className="rhythm-text-button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />Rhythm</button>
    <h1 ref={heading} tabIndex={-1}>{tracker.title}</h1>
    <div className="rhythm-range" aria-label="Chart window">{([7, 30, 90] as const).map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => { setRange(value); setSelected(null) }}>{value}d</button>)}</div>
    <p className="rhythm-date-range">{label(days[0].date)} – {label(end)}</p>
    <section aria-label="Cumulative progress"><div className="progress-heading"><div><h2>Cumulative progress</h2><p>Recorded days added together</p></div><strong>{days.at(-1)!.cumulative} {days.at(-1)!.cumulative === 1 ? 'day' : 'days'}</strong></div>
      <ProgressPlot days={[baseline, ...days]} metric="cumulative" maximum={Math.max(1, days.at(-1)!.cumulative)} onSelect={index => setSelected(Math.max(0, index - 1))} selectedDate={selected === null ? null : current.date} />
    </section>
    <section aria-label="Recent frequency"><div className="progress-heading"><div><h2>Recent frequency</h2><p>Recorded days in the trailing 7 days</p></div><strong>{days.at(-1)!.recent} / 7</strong></div>
      <ProgressPlot days={days} metric="recent" maximum={7} onSelect={setSelected} selectedDate={selected === null ? null : current.date} />
    </section>
    <label className="progress-inspector">Inspect a day<input type="range" min={0} max={days.length - 1} value={selected ?? days.length - 1} onChange={event => setSelected(Number(event.target.value))} aria-valuetext={`${label(current.date)}: ${current.recorded ? 'recorded' : 'no record'}, ${current.cumulative} cumulative days, ${current.recent} in trailing 7 days`} /></label>
    <p className="progress-detail" aria-live="polite">{label(current.date)} · {current.recorded ? 'Recorded' : 'No record'} · {current.cumulative} cumulative days · {current.recent} / 7 recent days</p>
    <p className="rhythm-footnote">Each recorded day counts once, regardless of quantity. Blank days stay neutral. Curves connect daily values.</p>
  </main>
}

function ProgressPlot({ days, metric, maximum, onSelect, selectedDate }: { days: ProgressDay[]; metric: 'cumulative' | 'recent'; maximum: number; onSelect: (index: number) => void; selectedDate: string | null }) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const titleId = useId()
  useEffect(() => {
    const node = host.current!
    const observer = new ResizeObserver(() => setWidth(node.clientWidth))
    setWidth(node.clientWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const left = 40, right = width - 12, top = 30, bottom = 161
  const points = days.map((day, i) => ({ x: left + (right - left) * i / (days.length - 1), y: bottom - day[metric] / maximum * (bottom - top) }))
  const path = smoothProgressPath(points)
  const ticks = metric === 'recent' ? [0, 2, 4, 7] : [...new Set([0, Math.round(maximum / 2), maximum])]
  const selected = days.findIndex(day => day.date === selectedDate)
  return <div className="progress-plot" ref={host}>
    <svg width="100%" height={202} viewBox={`0 0 ${width} 202`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>{metric === 'cumulative' ? 'Cumulative recorded days' : 'Trailing seven-day recorded days'}: {days.at(-1)![metric]} as of {label(days.at(-1)!.date)}</title>
      <text x={left} y={14}>{metric === 'cumulative' ? 'Cumulative days' : 'Days / 7-day window'}</text>
      {ticks.map(tick => { const y = bottom - tick / maximum * (bottom - top); return <g key={tick}><line x1={left} x2={right} y1={y} y2={y} className="progress-grid" /><text x={left - 8} y={y + 4} textAnchor="end">{tick}</text></g> })}
      <path d={`${path} L${right},${bottom} L${left},${bottom} Z`} className="progress-fill" />
      <path d={path} className="progress-line" />
      {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i, index) => <text key={i} x={points[i].x} y={187} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{label(days[i].date)}</text>)}
      {selected >= 0 && <g><line x1={points[selected].x} x2={points[selected].x} y1={top} y2={bottom} className="progress-guide" /><circle cx={points[selected].x} cy={points[selected].y} r={3} className="progress-point" /></g>}
      <rect x={left} y={top} width={Math.max(0, right - left)} height={bottom - top} fill="transparent" onPointerMove={event => {
        if (event.pointerType !== 'mouse') return
        const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
        onSelect(Math.max(0, Math.min(days.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (days.length - 1)))))
      }} onClick={event => {
        const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
        onSelect(Math.max(0, Math.min(days.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (days.length - 1)))))
      }} />
    </svg>
  </div>
}
