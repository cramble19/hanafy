import { useCallback, useEffect, useRef, useState } from 'react'

export type CrambleView = 'tracker' | 'observatory' | 'ledger' | 'ledgerDetail' | 'emotionHistory' | 'someday' | 'rhythm'
type Route = { view: CrambleView; questId?: string; area?: string; depth: number; dialogs: number }
const key = 'hanafyCramble'
const views: CrambleView[] = ['tracker', 'observatory', 'ledger', 'ledgerDetail', 'emotionHistory', 'someday', 'rhythm']
export function readCrambleRoute(value: unknown): Route | null {
  const route = (value as Record<string, Route> | null)?.[key]
  return route && views.includes(route.view) && Number.isInteger(route.depth) && route.depth >= 0
    ? { ...route, dialogs: Math.max(0, route.dialogs || 0) } : null
}

/** Real history entries let Android/browser Back traverse pages and dismiss dialogs. */
export function useCrambleNavigation(onExit?: () => void) {
  const [route, setRoute] = useState<Route>(() => typeof window === 'undefined'
    ? { view: 'tracker', depth: 0, dialogs: 0 }
    : { ...(readCrambleRoute(window.history?.state) ?? { view: 'tracker', depth: 0 }), dialogs: 0 })
  const current = useRef(route)
  const exit = useRef(onExit)
  exit.current = onExit
  useEffect(() => {
    const existing = readCrambleRoute(window.history.state)
    if (!existing && exit.current) window.history.pushState({ ...window.history.state, [key]: current.current }, '')
    else window.history.replaceState({ ...window.history.state, [key]: current.current }, '')
    let restoring = false
    let observedDialogs = 0
    const pop = (event: PopStateEvent) => {
      const next = readCrambleRoute(event.state)
      restoring = true
      const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')]
      const keep = next?.dialogs ?? 0
      dialogs.slice(keep).reverse().forEach(dialog => {
        const cancel = new Event('cancel', { cancelable: true })
        if (dialog.dispatchEvent(cancel)) dialog.close()
      })
      observedDialogs = keep
      if (next) { current.current = next; setRoute(next) }
      else exit.current?.()
      queueMicrotask(() => { restoring = false })
    }
    window.addEventListener('popstate', pop)
    const observer = new MutationObserver(() => {
      if (restoring) return
      const count = document.querySelectorAll('dialog[open]').length
      if (count === observedDialogs) return
      const delta = count - observedDialogs
      observedDialogs = count
      if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          current.current = { ...current.current, dialogs: current.current.dialogs + 1 }
          window.history.pushState({ ...window.history.state, [key]: current.current }, '')
        }
      } else if (current.current.dialogs > count) window.history.go(delta)
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => { observer.disconnect(); window.removeEventListener('popstate', pop) }
  }, [])
  const navigate = useCallback((view: CrambleView, details: { questId?: string; area?: string } = {}) => {
    const previous = current.current
    if (view === previous.view && details.questId === previous.questId && details.area === previous.area) return
    const next: Route = { view, ...details, depth: previous.depth + 1, dialogs: 0 }
    current.current = next
    window.history.pushState({ ...window.history.state, [key]: next }, '')
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  const back = useCallback(() => {
    if (current.current.depth > 0) window.history.back()
    else navigate('tracker')
  }, [navigate])
  return { route, navigate, back }
}
