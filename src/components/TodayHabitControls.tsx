import {
  CalendarClock,
  Download,
  Pause,
  Play,
  Settings,
} from 'lucide-react'
import { PAUSE_REASON_OPTIONS } from '@/lib/habitLifecycle'
import { LOGICAL_DAY_START_HOUR } from '@/lib/logicalDay'
import type { Quest, TrackingPause } from '@/types'

export function TodayProgressCard({
  profile,
  complete,
  total,
}: {
  profile: 'hana' | 'cramble'
  complete: number
  total: number
}) {
  const percent = total ? Math.round((complete / total) * 100) : null
  const summary = total
    ? `${complete} of ${total} habits complete today`
    : 'No habits are due today'
  return (
    <section className="today-progress-card" aria-label={summary}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              Today at a glance
            </p>
            <span
              className="rounded-full border border-border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-faint"
              aria-label={`Tracking day resets at ${LOGICAL_DAY_START_HOUR}:00 AM`}
              title="Anything recorded before 4:00 AM counts toward the previous date."
            >
              {LOGICAL_DAY_START_HOUR} AM reset
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold text-ink">
            {total === 0
              ? 'Nothing is asking for you today'
              : complete === total
                ? profile === 'hana' ? 'Today is blooming' : 'Today’s oath is kept'
                : `${complete} of ${total} complete`}
          </p>
        </div>
        <span className="today-progress-value">{percent === null ? '—' : `${percent}%`}</span>
      </div>
      <div
        className="today-progress-track"
        role="progressbar"
        aria-label="Today's habit completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? 'No habits due today' : `${percent}% complete`}
      >
        <span style={{ width: `${percent ?? 0}%` }} />
      </div>
    </section>
  )
}

export function ProfilePauseBanner({
  pause,
  onResume,
}: {
  pause: TrackingPause
  onResume: () => void
}) {
  const reason = PAUSE_REASON_OPTIONS.find((option) => option.value === pause.reason)
  return (
    <section className="tracking-pause-banner" role="status">
      <span className="tracking-pause-icon" aria-hidden="true"><Pause className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Tracking is paused</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          {reason?.label ?? 'A neutral break'}
          {pause.endDate ? ` · through ${formatDate(pause.endDate)}` : ' · until you resume'}.
          No progress, misses, or reminders are created.
        </p>
      </div>
      <button type="button" onClick={onResume} className="today-utility-button">
        <Play className="size-4" aria-hidden="true" /> Resume
      </button>
    </section>
  )
}

export function TodayUtilityActions({
  isPaused,
  onPause,
  onBackfill,
  onExport,
}: {
  isPaused: boolean
  onPause: () => void
  onBackfill: () => void
  onExport: () => void
}) {
  return (
    <div className="today-utility-grid" aria-label="Tracking tools">
      <button type="button" onClick={onPause} disabled={isPaused} className="today-utility-button">
        <Pause className="size-4" aria-hidden="true" /> Pause tracking
      </button>
      <button type="button" onClick={onBackfill} className="today-utility-button">
        <CalendarClock className="size-4" aria-hidden="true" /> Recent day
      </button>
      <button type="button" onClick={onExport} className="today-utility-button">
        <Download className="size-4" aria-hidden="true" /> Export CSV
      </button>
    </div>
  )
}

export function PausedHabitsCard({
  habits,
  onResume,
  onManage,
}: {
  habits: Quest[]
  onResume: (habitId: string) => void
  onManage: (habitId: string) => void
}) {
  if (!habits.length) return null
  return (
    <section className="paused-habits-card">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">Neutral for now</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Paused habits</h2>
      </div>
      <div className="mt-3 space-y-2">
        {habits.map((habit) => (
          <div key={habit.id} className="paused-habit-row">
            <span className="text-xl" aria-hidden="true">{habit.emoji}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{habit.title}</span>
            <button type="button" onClick={() => onManage(habit.id)} aria-label={`Manage ${habit.title}`} className="paused-habit-icon-button">
              <Settings className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onResume(habit.id)} className="today-utility-button">
              <Play className="size-4" aria-hidden="true" /> Resume
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
