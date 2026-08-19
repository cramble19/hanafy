import { CircleCheck, Star } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { GardenBlossomIcon } from '@/components/icons/GardenBlossomIcon'

export type QuestHubView = 'destination' | 'quests'
export type QuestHubProfile = 'hana' | 'cramble'

type Props = {
  profile: QuestHubProfile
  value: QuestHubView
  surface: 'light' | 'dark'
  onChange: (view: QuestHubView) => void
}

const VIEWS: QuestHubView[] = ['destination', 'quests']

export function questHubTabId(profile: QuestHubProfile, view: QuestHubView) {
  return `${profile}-${view}-hub-tab`
}

export function questHubPanelId(profile: QuestHubProfile, view: QuestHubView) {
  return `${profile}-${view}-hub-panel`
}

export function nextQuestHubView(
  currentView: QuestHubView,
  key: string,
): QuestHubView | null {
  const currentIndex = VIEWS.indexOf(currentView)

  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return VIEWS[(currentIndex + 1) % VIEWS.length]
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return VIEWS[(currentIndex - 1 + VIEWS.length) % VIEWS.length]
  }
  if (key === 'Home') return VIEWS[0]
  if (key === 'End') return VIEWS[VIEWS.length - 1]
  return null
}

export function QuestHubTabs({ profile, value, surface, onChange }: Props) {
  const tabsRef = useRef<Record<QuestHubView, HTMLButtonElement | null>>({
    destination: null,
    quests: null,
  })
  const destinationLabel = profile === 'hana' ? 'Garden' : 'Observatory'

  const selectAndFocus = (view: QuestHubView) => {
    onChange(view)
    tabsRef.current[view]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentView: QuestHubView,
  ) => {
    const nextView = nextQuestHubView(currentView, event.key)
    if (!nextView) return
    event.preventDefault()
    selectAndFocus(nextView)
  }

  return (
    <div
      className="relative z-20 grid grid-cols-2 gap-2"
      role="tablist"
      aria-label={`${destinationLabel} views`}
    >
      {VIEWS.map((view) => {
        const selected = value === view
        const isDestination = view === 'destination'
        const label = isDestination ? destinationLabel : "Today's quests"
        const detail = isDestination
          ? profile === 'hana'
            ? 'View your blooms'
            : 'Follow the road'
          : profile === 'hana'
            ? 'Tend today'
            : "Write today's chapter"
        const lightClasses = selected
          ? 'border-[color:rgba(99,139,78,0.72)] bg-[color:rgba(224,235,215,0.88)] text-ink shadow-sm'
          : 'border-border bg-surface/85 text-ink hover:bg-surface'
        const darkClasses = selected
          ? profile === 'hana'
            ? 'border-[color:rgba(168,200,152,0.78)] bg-[color:rgba(103,143,84,0.18)] text-white shadow-[0_0_0_1px_rgba(168,200,152,0.08)]'
            : 'border-[color:var(--cramble-brass)] bg-[color:rgba(214,163,66,0.10)] text-white shadow-[0_0_0_1px_rgba(214,163,66,0.08)]'
          : 'border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.10]'

        return (
          <button
            key={view}
            ref={(element) => {
              tabsRef.current[view] = element
            }}
            id={questHubTabId(profile, view)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={questHubPanelId(profile, view)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(view)}
            onKeyDown={(event) => handleKeyDown(event, view)}
            className={`flex min-h-16 items-center gap-2 rounded-control border px-3 py-2 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none ${
              surface === 'light' ? lightClasses : darkClasses
            } ${surface === 'light' ? 'focus-visible:ring-ink/35 focus-visible:ring-offset-canvas' : 'focus-visible:ring-white/70 focus-visible:ring-offset-[#101522]'}`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full border ${
                surface === 'light'
                  ? 'border-border bg-surface text-[color:#668c50]'
                  : selected
                    ? profile === 'hana'
                      ? 'border-[color:rgba(168,200,152,0.58)] bg-black/15 text-[color:#b8d5aa]'
                      : 'border-[color:rgba(214,163,66,0.55)] bg-black/15 text-[color:var(--cramble-brass)]'
                    : 'border-white/15 bg-black/10 text-white/78'
              }`}
              aria-hidden="true"
            >
              {isDestination ? (
                profile === 'hana' ? (
                  <GardenBlossomIcon className="size-5" />
                ) : (
                  <Star className="size-5" />
                )
              ) : (
                <CircleCheck className="size-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{label}</span>
              <span
                className={`mt-0.5 block truncate text-[10px] ${
                  surface === 'light' ? 'text-muted' : 'text-white/60'
                }`}
              >
                {detail}
              </span>
            </span>
            {selected ? (
              <CircleCheck
                className={`size-4 shrink-0 ${
                  surface === 'light'
                    ? 'text-[color:#668c50]'
                    : profile === 'hana'
                      ? 'text-[color:#b8d5aa]'
                      : 'text-[color:var(--cramble-brass)]'
                }`}
                aria-hidden="true"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
