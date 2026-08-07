export const PWA_UPDATE_CHECK_THROTTLE_MS = 5 * 60 * 1000
export const PWA_UPDATE_INTERVAL_MS = 60 * 60 * 1000
export const PWA_UPDATED_SESSION_KEY = 'hanafy-pwa/updated-v1'

export type PwaUpdateCheckInput = {
  now: number
  lastCheckedAt: number
  isOnline: boolean
  isVisible: boolean
  hasRegistration: boolean
  isInstalling: boolean
  force?: boolean
}

/** Keeps foreground checks useful without asking the browser on every focus event. */
export function shouldCheckForPwaUpdate({
  now,
  lastCheckedAt,
  isOnline,
  isVisible,
  hasRegistration,
  isInstalling,
  force = false,
}: PwaUpdateCheckInput) {
  if (!hasRegistration || !isOnline || !isVisible || isInstalling) {
    return false
  }

  return force || now - lastCheckedAt >= PWA_UPDATE_CHECK_THROTTLE_MS
}

export function rememberPwaUpdateReload(storage: Storage) {
  storage.setItem(PWA_UPDATED_SESSION_KEY, 'true')
}

export function consumePwaUpdateReload(storage: Storage) {
  const shouldConfirm = storage.getItem(PWA_UPDATED_SESSION_KEY) === 'true'
  storage.removeItem(PWA_UPDATED_SESSION_KEY)
  return shouldConfirm
}
