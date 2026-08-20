import { Compass, Leaf, Minus, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { EmotionFaceIcon } from '@/components/icons/EmotionFaceIcon'
import flowerLogWallpaper from '@/assets/flower-log-wallpaper.jpg'
import type { DailyEmotion, OpenActivity } from '@/types'

export type AnytimeLogProfile = 'hana' | 'cramble'
export type AnytimeLogFilter = 'all' | 'unlogged' | 'logged'

export const ANYTIME_LOG_HOLD_DELAY_MS = 550
const ANYTIME_LOG_HOLD_MOVE_TOLERANCE_PX = 12

const FILTER_OPTIONS: ReadonlyArray<{
  value: AnytimeLogFilter
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'unlogged', label: 'Unlogged' },
  { value: 'logged', label: 'Logged' },
]

const RATING_EMOTIONS: readonly DailyEmotion[] = [
  'heavy',
  'low',
  'okay',
  'good',
  'bright',
]

const FIELD_LOG_WALLPAPER_ASPECT = 365 / 547

export function calculateSharedWallpaperLayout(
  containerWidth: number,
  containerHeight: number,
  cardOffsetX: number,
  cardOffsetY: number,
) {
  const containerAspect = containerWidth / containerHeight
  const imageWidth =
    containerAspect > FIELD_LOG_WALLPAPER_ASPECT
      ? containerWidth
      : containerHeight * FIELD_LOG_WALLPAPER_ASPECT
  const imageHeight = imageWidth / FIELD_LOG_WALLPAPER_ASPECT
  const imageOriginX = (containerWidth - imageWidth) / 2
  const imageOriginY = (containerHeight - imageHeight) / 2

  return {
    imageWidth,
    imageHeight,
    positionX: imageOriginX - cardOffsetX,
    positionY: imageOriginY - cardOffsetY,
  }
}

export type AnytimeLogMosaicGroup = {
  feature: OpenActivity
  compact: OpenActivity[]
  featureSide: 'left' | 'right'
}

/**
 * Builds three-item mosaics in saved order. Rating controls use the feature
 * slot; count logs can use either size so sparse real-world lists do not leave
 * accidental holes. A second rating starts a fresh group because two five-face
 * scales cannot share one compact cluster.
 */
export function groupAnytimeActivitiesForMosaic(
  activities: OpenActivity[],
): AnytimeLogMosaicGroup[] {
  const groups: AnytimeLogMosaicGroup[] = []
  let pending: OpenActivity[] = []

  const finishGroup = () => {
    if (pending.length === 0) return

    const ratingIndex = pending.findIndex(
      (activity) => activity.kind === 'rating',
    )
    const countIndex = pending.findIndex(
      (activity) => activity.kind === 'count',
    )
    const featureIndex = ratingIndex >= 0 ? ratingIndex : countIndex
    const resolvedFeatureIndex = featureIndex >= 0 ? featureIndex : 0
    const feature = pending[resolvedFeatureIndex]
    const compact = pending.filter((_, index) => index !== resolvedFeatureIndex)

    groups.push({
      feature,
      compact,
      featureSide: groups.length % 2 === 0 ? 'left' : 'right',
    })
    pending = []
  }

  activities.forEach((activity) => {
    const hasRatingLog = pending.some(
      (pendingActivity) => pendingActivity.kind === 'rating',
    )
    if (activity.kind === 'rating' && hasRatingLog) finishGroup()

    pending.push(activity)
    if (pending.length === 3) finishGroup()
  })
  finishGroup()

  return groups
}

export function filterAnytimeActivities(
  activities: OpenActivity[],
  todayCounts: Record<string, number>,
  filter: AnytimeLogFilter,
): OpenActivity[] {
  if (filter === 'all') return activities

  const showLogged = filter === 'logged'
  return activities.filter((activity) => {
    const logged = (todayCounts[activity.id] ?? 0) > 0
    return logged === showLogged
  })
}

export function isAnytimeLogManageKey(
  key: string,
  shiftKey: boolean,
): boolean {
  return key === 'ContextMenu' || (key === 'F10' && shiftKey)
}

function useSharedWallpaperLayout(
  resultsRef: { current: HTMLDivElement | null },
  enabled: boolean,
  layoutKey: string,
) {
  useEffect(() => {
    const results = resultsRef.current
    if (!enabled || !results) return

    let animationFrame: number | null = null
    const updateCardCoordinates = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const resultsRect = results.getBoundingClientRect()
        const cards = results.querySelectorAll<HTMLElement>(
          '[data-anytime-wallpaper-card="true"]',
        )

        if (resultsRect.width <= 0 || resultsRect.height <= 0) return

        cards.forEach((card) => {
          const cardRect = card.getBoundingClientRect()
          const wallpaper = calculateSharedWallpaperLayout(
            resultsRect.width,
            resultsRect.height,
            cardRect.left - resultsRect.left,
            cardRect.top - resultsRect.top,
          )
          card.style.setProperty(
            '--anytime-wallpaper-left',
            `${wallpaper.positionX}px`,
          )
          card.style.setProperty(
            '--anytime-wallpaper-top',
            `${wallpaper.positionY}px`,
          )
          card.style.setProperty(
            '--anytime-wallpaper-width',
            `${wallpaper.imageWidth}px`,
          )
          card.style.setProperty(
            '--anytime-wallpaper-height',
            `${wallpaper.imageHeight}px`,
          )
        })
        results.dataset.anytimeWallpaperReady = 'true'
      })
    }

    updateCardCoordinates()
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateCardCoordinates)
    resizeObserver?.observe(results)
    results
      .querySelectorAll<HTMLElement>('[data-anytime-wallpaper-card="true"]')
      .forEach((card) => resizeObserver?.observe(card))
    window.addEventListener('resize', updateCardCoordinates)

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateCardCoordinates)
      delete results.dataset.anytimeWallpaperReady
    }
  }, [enabled, layoutKey, resultsRef])
}

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
  onAdd?: () => void
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
  onAdd,
}: AnytimeLogSectionProps) {
  const titleId = useId()
  const interactionHintId = useId()
  const resultsId = useId()
  const filterRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<AnytimeLogFilter>('all')
  const HeadingIcon = profile === 'hana' ? Leaf : Compass
  const filteredActivities = filterAnytimeActivities(
    activities,
    todayCounts,
    filter,
  )
  const boardActivities = filteredActivities
  const mosaicGroups = groupAnytimeActivitiesForMosaic(boardActivities)
  const wallpaperLayoutKey = `${filter}:${boardActivities
    .map((activity) => `${activity.id}:${activity.kind}`)
    .join('|')}`
  useSharedWallpaperLayout(
    resultsRef,
    boardActivities.length > 0,
    wallpaperLayoutKey,
  )

  const moveFocusBeforeRemoval = (activityId: string) => {
    const cards = Array.from(
      resultsRef.current?.querySelectorAll<HTMLElement>(
        '[data-anytime-activity-id]',
      ) ?? [],
    )
    const currentIndex = cards.findIndex(
      (card) => card.dataset.anytimeActivityId === activityId,
    )
    const nextCard =
      cards[currentIndex + 1] ??
      (currentIndex > 0 ? cards[currentIndex - 1] : undefined)
    const nextAction = nextCard?.querySelector<HTMLElement>(
      '[data-anytime-primary-action]:not(:disabled)',
    )

    if (nextAction) {
      nextAction.focus()
      return
    }

    filterRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.focus()
  }

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
          <p id={interactionHintId} className="anytime-log-interaction-hint">
            Tap a log to record · Hold to edit
          </p>
        </div>
      </div>

      {activities.length > 0 ? (
        <>
          <div
            ref={filterRef}
            className="anytime-log-filter"
            role="group"
            aria-label="Filter anytime logs"
          >
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="anytime-log-filter-option"
                data-active={filter === option.value}
                aria-pressed={filter === option.value}
                aria-controls={resultsId}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Showing {filteredActivities.length} of {activities.length} anytime
            logs.
          </p>

          <div
            ref={resultsRef}
            id={resultsId}
            className="anytime-log-results"
            data-filter={filter}
            data-anytime-wallpaper="shared-flower"
            style={
              {
                '--anytime-wallpaper-image': `url(${flowerLogWallpaper})`,
              } as CSSProperties
            }
          >
            {boardActivities.length > 0 ? (
              <div
                className="anytime-log-board"
                role="list"
                aria-label="Anytime logs"
              >
                {mosaicGroups.map((group) => {
                  const orderedActivities =
                    group.featureSide === 'left'
                      ? [group.feature, ...group.compact]
                      : [...group.compact, group.feature]

                  return (
                    <div
                      key={group.feature.id}
                      className="anytime-log-mosaic-group"
                      data-feature-side={group.featureSide}
                      role="presentation"
                    >
                      {orderedActivities.map((activity) => (
                        <AnytimeLogCard
                          key={activity.id}
                          layout="board"
                          mosaicSize={
                            activity.id === group.feature.id
                              ? 'feature'
                              : 'compact'
                          }
                          profile={profile}
                          activity={activity}
                          todayCount={todayCounts[activity.id] ?? 0}
                          disabled={disabled}
                          onIncrement={onIncrement}
                          onDecrement={onDecrement}
                          onSetRating={onSetRating}
                          onManage={onManage}
                          interactionHintId={interactionHintId}
                          hideWhenRecorded={filter === 'unlogged'}
                          hideWhenCleared={filter === 'logged'}
                          onWillHide={moveFocusBeforeRemoval}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {filteredActivities.length === 0 ? (
              <p className="anytime-log-empty anytime-log-filter-empty">
                {filter === 'logged'
                  ? 'Nothing has been logged today. Choose All or Unlogged to find an activity.'
                  : 'Everything is logged for today. Choose All or Logged to review your entries.'}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="anytime-log-empty">
          Nothing recorded here yet. Add an anytime log for moments worth
          remembering.
        </p>
      )}

      {onAdd ? (
        <button
          type="button"
          className="anytime-log-add"
          onClick={onAdd}
        >
          <Plus aria-hidden="true" />
          {profile === 'hana' ? 'Add a log' : 'Add a field log'}
        </button>
      ) : null}

    </section>
  )
}

type CardProps = {
  layout: 'rating' | 'board'
  mosaicSize?: 'feature' | 'compact'
  profile: AnytimeLogProfile
  activity: OpenActivity
  todayCount: number
  disabled: boolean
  onIncrement: (activityId: string) => void
  onDecrement: (activityId: string) => void
  onSetRating: (activityId: string, rating: number) => void
  onManage?: (activityId: string) => void
  interactionHintId: string
  hideWhenRecorded: boolean
  hideWhenCleared: boolean
  onWillHide: (activityId: string) => void
}

function AnytimeLogCard({
  layout,
  mosaicSize,
  profile,
  activity,
  todayCount,
  disabled,
  onIncrement,
  onDecrement,
  onSetRating,
  onManage,
  interactionHintId,
  hideWhenRecorded,
  hideWhenCleared,
  onWillHide,
}: CardProps) {
  const count = Number.isSafeInteger(todayCount) ? Math.max(0, todayCount) : 0
  const checked = activity.kind === 'check' && count > 0
  const recorded = count > 0
  const isRating = activity.kind === 'rating'
  const hasSharedWallpaper = layout === 'board'
  const unit = activity.unit?.trim() || 'times'
  const countLabel = `${count} ${unit} today`
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
  } | null>(null)
  const suppressNextClickRef = useRef(false)
  const lastManageTimeRef = useRef(0)

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  useEffect(() => () => clearHoldTimer(), [])

  const toggleCheckLog = () => {
    if (disabled || activity.kind !== 'check') return

    if ((checked && hideWhenCleared) || (!checked && hideWhenRecorded)) {
      onWillHide(activity.id)
    }
    checked ? onDecrement(activity.id) : onIncrement(activity.id)
  }

  const openManage = () => {
    if (disabled || !onManage) return
    lastManageTimeRef.current = Date.now()
    onManage(activity.id)
  }

  const handleCheckPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (
      disabled ||
      !onManage ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return
    }

    clearHoldTimer()
    suppressNextClickRef.current = false
    pressStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    holdTimerRef.current = setTimeout(() => {
      if (!pressStartRef.current) return
      holdTimerRef.current = null
      suppressNextClickRef.current = true
      openManage()
    }, ANYTIME_LOG_HOLD_DELAY_MS)
  }

  const handleCheckPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const pressStart = pressStartRef.current
    if (!pressStart || pressStart.pointerId !== event.pointerId) return

    const moved = Math.hypot(
      event.clientX - pressStart.clientX,
      event.clientY - pressStart.clientY,
    )
    if (moved <= ANYTIME_LOG_HOLD_MOVE_TOLERANCE_PX) return

    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
  }

  const finishCheckPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (pressStartRef.current?.pointerId !== event.pointerId) return

    clearHoldTimer()
    pressStartRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelCheckPointer = () => {
    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
  }

  const handleCheckLostPointerCapture = () => {
    const interrupted = pressStartRef.current !== null
    clearHoldTimer()
    pressStartRef.current = null
    if (interrupted) suppressNextClickRef.current = true
  }

  const handleCheckContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!onManage) return

    event.preventDefault()
    clearHoldTimer()
    pressStartRef.current = null
    suppressNextClickRef.current = true
    if (Date.now() - lastManageTimeRef.current < 800) return
    openManage()
  }

  const handleCheckKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!isAnytimeLogManageKey(event.key, event.shiftKey) || !onManage) {
      if (event.key === 'Enter' || event.key === ' ') {
        suppressNextClickRef.current = false
      }
      return
    }

    event.preventDefault()
    openManage()
  }

  return (
    <article
      className={`anytime-log-card anytime-log-card-${profile} anytime-log-card-${layout} anytime-log-kind-${activity.kind}${recorded ? ' anytime-log-card-recorded' : ''}`}
      data-recorded={recorded}
      data-kind={activity.kind}
      data-disabled={disabled}
      data-anytime-activity-id={activity.id}
      data-anytime-wallpaper-card={hasSharedWallpaper ? 'true' : undefined}
      data-mosaic-size={layout === 'board' ? mosaicSize : undefined}
      role="listitem"
    >
      {activity.kind === 'check' ? (
        <button
          type="button"
          className="anytime-log-card-toggle"
          onPointerDown={handleCheckPointerDown}
          onPointerMove={handleCheckPointerMove}
          onPointerUp={finishCheckPointer}
          onPointerCancel={cancelCheckPointer}
          onLostPointerCapture={handleCheckLostPointerCapture}
          onClick={() => {
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false
              return
            }
            toggleCheckLog()
          }}
          onContextMenu={handleCheckContextMenu}
          onKeyDown={handleCheckKeyDown}
          disabled={disabled}
          data-anytime-primary-action
          aria-describedby={interactionHintId}
          aria-keyshortcuts="Enter Space Shift+F10 ContextMenu"
          aria-pressed={checked}
          aria-label={
            checked
              ? `Undo today's log for ${activity.title}`
              : `Log ${activity.title} for today`
          }
          title={checked ? 'Tap to undo · Hold to edit' : 'Tap to record · Hold to edit'}
        />
      ) : null}

      <div className="anytime-log-copy">
        <h3>{activity.title}</h3>
        <p>{activity.description}</p>
        {activity.kind === 'count' ? (
          <span className="anytime-log-today-count" aria-live="polite" aria-atomic="true">
            {countLabel}
          </span>
        ) : isRating ? (
          <span className="anytime-log-today-count" aria-live="polite" aria-atomic="true">
            {count > 0
              ? `${activity.title} logged: ${Math.min(5, count)} of 5`
              : 'Choose 1 to 5'}
          </span>
        ) : null}
        {activity.kind === 'check' ? (
          <span
            className="sr-only"
            data-anytime-recorded-status
            aria-live="polite"
            aria-atomic="true"
          >
            {recorded
              ? `${activity.title} recorded today.`
              : `${activity.title} not recorded today.`}
          </span>
        ) : null}
      </div>

      {activity.kind === 'count' && layout === 'board' && onManage ? (
        <button
          type="button"
          className="anytime-log-card-manage-surface"
          onPointerDown={handleCheckPointerDown}
          onPointerMove={handleCheckPointerMove}
          onPointerUp={finishCheckPointer}
          onPointerCancel={cancelCheckPointer}
          onLostPointerCapture={handleCheckLostPointerCapture}
          onClick={(event) => {
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false
              return
            }
            if (event.detail === 0) openManage()
          }}
          onContextMenu={handleCheckContextMenu}
          onKeyDown={handleCheckKeyDown}
          disabled={disabled}
          aria-describedby={interactionHintId}
          aria-keyshortcuts="Enter Space Shift+F10 ContextMenu"
          aria-label={`Edit ${activity.title}`}
          title="Hold to edit"
        />
      ) : null}

      {activity.kind === 'check' ? null : activity.kind === 'rating' ? (
        <div
          className="anytime-log-rating"
          role="group"
          aria-label={`${activity.title} out of five`}
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => {
                if (!recorded && hideWhenRecorded) {
                  onWillHide(activity.id)
                }
                onSetRating(activity.id, rating)
              }}
              disabled={disabled}
              data-anytime-primary-action
              aria-pressed={count === rating}
              aria-label={`Rate ${activity.title} ${rating} out of 5`}
            >
              <EmotionFaceIcon
                emotion={RATING_EMOTIONS[rating - 1]}
                profile={profile}
                className="anytime-log-rating-icon"
              />
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
            onClick={() => {
              if (count === 1 && hideWhenCleared) {
                onWillHide(activity.id)
              }
              onDecrement(activity.id)
            }}
            disabled={disabled || count === 0}
            aria-label={`Subtract one ${unit} from ${activity.title}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <output aria-label={countLabel}>{count}</output>
          <button
            type="button"
            onClick={() => {
              if (!recorded && hideWhenRecorded) {
                onWillHide(activity.id)
              }
              onIncrement(activity.id)
            }}
            disabled={disabled}
            data-anytime-primary-action
            aria-label={`Add one ${unit} to ${activity.title}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  )
}
