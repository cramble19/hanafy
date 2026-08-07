import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import { TogetherMark } from '@/components/icons/TogetherMark'
import {
  consumePwaUpdateReload,
  PWA_UPDATE_INTERVAL_MS,
  rememberPwaUpdateReload,
  shouldCheckForPwaUpdate,
} from '@/lib/pwaUpdate'

type UpdateNotice = 'hidden' | 'ready' | 'updating' | 'updated'

export function PwaUpdatePrompt() {
  const [notice, setNotice] = useState<UpdateNotice>('hidden')
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const lastCheckedAtRef = useRef(0)
  const deferredUntilForegroundRef = useRef(false)
  const disposedRef = useRef(false)

  const checkForUpdate = useCallback((force = false) => {
    const registration = registrationRef.current
    const now = Date.now()
    if (
      !shouldCheckForPwaUpdate({
        now,
        lastCheckedAt: lastCheckedAtRef.current,
        isOnline: navigator.onLine,
        isVisible: document.visibilityState === 'visible',
        hasRegistration: Boolean(registration),
        isInstalling: Boolean(registration?.installing),
        force,
      })
    ) {
      return
    }

    lastCheckedAtRef.current = now
    void registration?.update().catch(() => {
      // Update checks are opportunistic. Offline/profile sync UI already reports
      // connection problems, so a background PWA check should stay quiet.
    })
  }, [])

  useEffect(() => {
    disposedRef.current = false
    registerSW({
      immediate: true,
      onNeedReload: () => {
        if (!disposedRef.current) setNotice('ready')
      },
      onRegisteredSW: (_serviceWorkerUrl, registration) => {
        if (disposedRef.current || !registration) return
        registrationRef.current = registration
        checkForUpdate(true)
      },
      onRegisterError: (error) => {
        console.error('Hanafy update registration failed', error)
      },
    })

    return () => {
      disposedRef.current = true
      registrationRef.current = null
    }
  }, [checkForUpdate])

  useEffect(() => {
    const checkWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (deferredUntilForegroundRef.current) {
        deferredUntilForegroundRef.current = false
        setNotice('ready')
      }
      checkForUpdate()
    }
    const checkWhenFocused = () => checkForUpdate()
    const checkAfterReconnect = () => checkForUpdate(true)
    const intervalId = window.setInterval(
      () => checkForUpdate(),
      PWA_UPDATE_INTERVAL_MS,
    )

    document.addEventListener('visibilitychange', checkWhenVisible)
    window.addEventListener('focus', checkWhenFocused)
    window.addEventListener('online', checkAfterReconnect)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', checkWhenVisible)
      window.removeEventListener('focus', checkWhenFocused)
      window.removeEventListener('online', checkAfterReconnect)
    }
  }, [checkForUpdate])

  useEffect(() => {
    try {
      if (consumePwaUpdateReload(window.sessionStorage)) {
        setNotice('updated')
      }
    } catch {
      // Storage can be unavailable in strict privacy modes; updates still work.
    }
  }, [])

  useEffect(() => {
    if (notice !== 'updated') return
    const timeoutId = window.setTimeout(() => setNotice('hidden'), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const updateNow = () => {
    setNotice('updating')
    try {
      rememberPwaUpdateReload(window.sessionStorage)
    } catch {
      // The confirmation is optional; the reload itself does not need storage.
    }
    window.setTimeout(() => window.location.reload(), 120)
  }

  const updateLater = () => {
    deferredUntilForegroundRef.current = true
    setNotice('hidden')
  }

  if (notice === 'hidden') return null

  const isReady = notice === 'ready'
  const isUpdating = notice === 'updating'
  const isUpdated = notice === 'updated'

  return (
    <aside
      className="pwa-update-layer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pwa-update-toast" data-state={notice}>
        <div className="flex min-w-0 items-start gap-3">
          {isUpdated ? (
            <span className="pwa-update-success-icon" aria-hidden="true">
              <CheckCircle2 className="size-5" />
            </span>
          ) : (
            <TogetherMark className="pwa-update-mark shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="pwa-update-title">
              {isReady
                ? 'New version ready'
                : isUpdating
                  ? 'Updating Hanafy…'
                  : 'Hanafy is up to date'}
            </p>
            <p className="pwa-update-copy">
              {isReady
                ? 'Update once to see the latest changes. Your saved progress stays safe.'
                : isUpdating
                  ? 'The app will reopen with the latest version.'
                  : 'The latest changes are ready to use.'}
            </p>
          </div>
        </div>

        {isReady ? (
          <div className="pwa-update-actions">
            <button
              type="button"
              onClick={updateLater}
              className="pwa-update-later"
            >
              Later
            </button>
            <button
              type="button"
              onClick={updateNow}
              className="pwa-update-now"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Update now
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
