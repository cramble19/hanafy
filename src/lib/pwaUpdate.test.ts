import { describe, expect, it } from 'vitest'
import {
  PWA_UPDATED_SESSION_KEY,
  PWA_UPDATE_CHECK_THROTTLE_MS,
  consumePwaUpdateReload,
  rememberPwaUpdateReload,
  shouldCheckForPwaUpdate,
} from './pwaUpdate'

describe('PWA update policy', () => {
  it('checks when registration is ready and the throttle has elapsed', () => {
    expect(
      shouldCheckForPwaUpdate({
        now: PWA_UPDATE_CHECK_THROTTLE_MS,
        lastCheckedAt: 0,
        isOnline: true,
        isVisible: true,
        hasRegistration: true,
        isInstalling: false,
      }),
    ).toBe(true)

    expect(
      shouldCheckForPwaUpdate({
        now: PWA_UPDATE_CHECK_THROTTLE_MS - 1,
        lastCheckedAt: 0,
        isOnline: true,
        isVisible: true,
        hasRegistration: true,
        isInstalling: false,
      }),
    ).toBe(false)
  })

  it('skips checks while offline, hidden, unregistered, or installing', () => {
    const ready = {
      now: PWA_UPDATE_CHECK_THROTTLE_MS,
      lastCheckedAt: 0,
      isOnline: true,
      isVisible: true,
      hasRegistration: true,
      isInstalling: false,
    }

    expect(shouldCheckForPwaUpdate({ ...ready, isOnline: false })).toBe(false)
    expect(shouldCheckForPwaUpdate({ ...ready, isVisible: false })).toBe(false)
    expect(shouldCheckForPwaUpdate({ ...ready, hasRegistration: false })).toBe(false)
    expect(shouldCheckForPwaUpdate({ ...ready, isInstalling: true })).toBe(false)
  })

  it('allows a reconnect check to bypass only the time throttle', () => {
    expect(
      shouldCheckForPwaUpdate({
        now: 10,
        lastCheckedAt: 9,
        isOnline: true,
        isVisible: true,
        hasRegistration: true,
        isInstalling: false,
        force: true,
      }),
    ).toBe(true)

    expect(
      shouldCheckForPwaUpdate({
        now: 10,
        lastCheckedAt: 9,
        isOnline: false,
        isVisible: true,
        hasRegistration: true,
        isInstalling: false,
        force: true,
      }),
    ).toBe(false)
  })

  it('stores and consumes the one-time updated confirmation', () => {
    const values = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => {
        values.delete(key)
      },
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    }

    rememberPwaUpdateReload(storage)
    expect(values.get(PWA_UPDATED_SESSION_KEY)).toBe('true')
    expect(consumePwaUpdateReload(storage)).toBe(true)
    expect(consumePwaUpdateReload(storage)).toBe(false)
  })
})
