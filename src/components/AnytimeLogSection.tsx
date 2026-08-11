import { Check, Compass, Leaf, Minus, Plus, Settings2 } from 'lucide-react'
import { type CSSProperties, useId } from 'react'
import type { OpenActivity } from '@/types'

export type AnytimeLogProfile = 'hana' | 'cramble'

export type AnytimeLogSectionProps = {
  profile: AnytimeLogProfile
  activities: OpenActivity[]
  /** Counts for the current 04:00-to-04:00 tracker day. */
  todayCounts: Record<string, number>
  /** Profile pauses can leave the field notes visible while preventing new logs. */
  disabled?: boolean
  onIncrement: (activityId: string) => void
  onDecrement: (activityId: string) => void
  onSetRating: (activityId: string, rating: number) => void
  onManage?: (activityId: string) => void
}

export function AnytimeLogSection({
  profile,
  activities,
  todayCounts,
  disabled = false,
  onIncrement,
  onDecrement,
  onSetRating,
  onManage,
}: AnytimeLogSectionProps) {
  const titleId = useId()
  const HeadingIcon = profile === 'hana' ? Leaf : Compass

  return (
    <section
      className={`anytime-log-section anytime-log-section-${profile}`}
      aria-labelledby={titleId}
    >
      <div className="anytime-log-heading">
        <span className="anytime-log-heading-icon" aria-hidden="true">
          <HeadingIcon />
        </span>
        <div>
          <h2 id={titleId}>
            {profile === 'hana' ? "Today's activity log" : "Today's field log"}
          </h2>
          <p>
            {profile === 'hana'
              ? 'No deadline · record only what happened'
              : 'No deadline · record what happened'}
          </p>
        </div>
      </div>

      {activities.length > 0 ? (
        <div className="anytime-log-list">
          {activities.map((activity) => (
            <AnytimeLogCard
              key={activity.id}
              profile={profile}
              activity={activity}
              todayCount={todayCounts[activity.id] ?? 0}
              disabled={disabled}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onSetRating={onSetRating}
              onManage={onManage}
            />
          ))}
        </div>
      ) : (
        <p className="anytime-log-empty">
          Nothing recorded here yet. Add an anytime log for moments worth
          remembering.
        </p>
      )}

      <p className="anytime-log-score-note">
        <span aria-hidden="true">{profile === 'hana' ? '❧' : 'ⓘ'}</span>
        Anytime logs don&apos;t change today&apos;s{' '}
        {profile === 'hana' ? 'quest' : 'oath'} score.
      </p>
    </section>
  )
}

type CardProps = {
  profile: AnytimeLogProfile
  activity: OpenActivity
  todayCount: number
  disabled: boolean
  onIncrement: (activityId: string) => void
  onDecrement: (activityId: string) => void
  onSetRating: (activityId: string, rating: number) => void
  onManage?: (activityId: string) => void
}

function AnytimeLogCard({
  profile,
  activity,
  todayCount,
  disabled,
  onIncrement,
  onDecrement,
  onSetRating,
  onManage,
}: CardProps) {
  const count = Number.isSafeInteger(todayCount) ? Math.max(0, todayCount) : 0
  const checked = activity.kind === 'check' && count > 0
  const isRating = activity.kind === 'rating'
  const unit = activity.unit?.trim() || 'times'
  const countLabel = `${count} ${unit} today`

  return (
    <article className={`anytime-log-card anytime-log-card-${profile}`}>
      {onManage && !isRating ? (
        <button
          type="button"
          className="anytime-log-emblem anytime-log-manage"
          onClick={() => onManage(activity.id)}
          aria-label={`Manage ${activity.title}`}
          title={`Manage ${activity.title}`}
          style={{
            '--activity-color': activity.color,
          } as CSSProperties}
        >
          <span className="anytime-log-emoji" aria-hidden="true">
            {activity.emoji}
          </span>
          <span className="anytime-log-settings-badge" aria-hidden="true">
            <Settings2 />
          </span>
        </button>
      ) : (
        <span
          className="anytime-log-emblem"
          aria-hidden="true"
          style={{
            '--activity-color': activity.color,
          } as CSSProperties}
        >
          <span className="anytime-log-emoji">{activity.emoji}</span>
        </span>
      )}

      <div className="anytime-log-copy">
        <h3>{activity.title}</h3>
        <p>{activity.description}</p>
        {activity.kind === 'count' ? (
          <span className="anytime-log-today-count" aria-live="polite" aria-atomic="true">
            {countLabel}
          </span>
        ) : isRating ? (
          <span className="anytime-log-today-count" aria-live="polite" aria-atomic="true">
            {count > 0 ? `Energy logged: ${Math.min(5, count)} of 5` : 'Choose 1 to 5'}
          </span>
        ) : (
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {checked ? `${activity.title} logged today.` : `${activity.title} not logged today.`}
          </span>
        )}
      </div>

      {activity.kind === 'check' ? (
        <button
          type="button"
          className={`anytime-log-check-button ${checked ? 'anytime-log-check-button-logged' : ''}`}
          onClick={() =>
            checked ? onDecrement(activity.id) : onIncrement(activity.id)
          }
          disabled={disabled}
          aria-pressed={checked}
          aria-label={
            checked
              ? `Undo today's log for ${activity.title}`
              : `Log ${activity.title} for today`
          }
        >
          {checked ? (
            <>
              <span><Check aria-hidden="true" /> Logged today</span>
              <small>Undo</small>
            </>
          ) : (
            'Log today'
          )}
        </button>
      ) : activity.kind === 'rating' ? (
        <div
          className="anytime-log-rating"
          role="group"
          aria-label={`${activity.title} out of five`}
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onSetRating(activity.id, rating)}
              disabled={disabled}
              aria-pressed={count === rating}
              aria-label={`Rate ${activity.title} ${rating} out of 5`}
            >
              {rating}
            </button>
          ))}
          <span className="anytime-log-rating-scale" aria-hidden="true">
            <small>Very low</small><small>Very high</small>
          </span>
        </div>
      ) : (
        <div className="anytime-log-stepper" role="group" aria-label={`Today's ${activity.title} count`}>
          <button
            type="button"
            onClick={() => onDecrement(activity.id)}
            disabled={disabled || count === 0}
            aria-label={`Subtract one ${unit} from ${activity.title}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <output aria-label={countLabel}>{count}</output>
          <button
            type="button"
            onClick={() => onIncrement(activity.id)}
            disabled={disabled}
            aria-label={`Add one ${unit} to ${activity.title}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  )
}
