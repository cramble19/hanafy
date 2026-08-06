import { useEffect, useRef } from 'react'

/** Moves focus to a newly mounted SPA screen heading without scrolling it. */
export function usePageHeadingFocus() {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return headingRef
}
