import { useRef, type KeyboardEvent } from 'react'

export type TrackerView = 'quests' | 'anytime'
export type TrackerViewProfile = 'hana' | 'cramble'

type Props = {
  profile: TrackerViewProfile
  value: TrackerView
  onChange: (view: TrackerView) => void
}

const VIEWS: TrackerView[] = ['quests', 'anytime']

export function trackerViewTabId(profile: TrackerViewProfile, view: TrackerView) {
  return `${profile}-${view}-view-tab`
}

export function trackerViewPanelId(profile: TrackerViewProfile, view: TrackerView) {
  return `${profile}-${view}-view-panel`
}

export function TrackerViewTabs({ profile, value, onChange }: Props) {
  const tabsRef = useRef<Record<TrackerView, HTMLButtonElement | null>>({
    quests: null,
    anytime: null,
  })

  const selectAndFocus = (view: TrackerView) => {
    onChange(view)
    tabsRef.current[view]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentView: TrackerView,
  ) => {
    const currentIndex = VIEWS.indexOf(currentView)
    let nextView: TrackerView | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextView = VIEWS[(currentIndex + 1) % VIEWS.length]
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextView = VIEWS[(currentIndex - 1 + VIEWS.length) % VIEWS.length]
    } else if (event.key === 'Home') {
      nextView = VIEWS[0]
    } else if (event.key === 'End') {
      nextView = VIEWS[VIEWS.length - 1]
    }

    if (!nextView) return
    event.preventDefault()
    selectAndFocus(nextView)
  }

  return (
    <div
      className={`tracker-view-tabs tracker-view-tabs-${profile}`}
      role="tablist"
      aria-label={`${profile === 'hana' ? 'Hana' : 'Cramble'} tracker view`}
    >
      {VIEWS.map((view) => {
        const selected = value === view
        return (
          <button
            key={view}
            ref={(element) => {
              tabsRef.current[view] = element
            }}
            id={trackerViewTabId(profile, view)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={trackerViewPanelId(profile, view)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(view)}
            onKeyDown={(event) => handleKeyDown(event, view)}
          >
            {view === 'quests' ? "Today's quests" : 'Anytime log'}
          </button>
        )
      })}
    </div>
  )
}
