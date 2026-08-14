import { describe, expect, it } from 'vitest'
import { createStartedHanaState } from '@/lib/hanaGame'
import {
  HANA_PENDING_STORAGE_KEY,
  readLocalProfileEmotion,
  readLocalProfileState,
} from '@/lib/profileCache'
import {
  PENDING_PROFILE_SYNC_FORMAT,
  PENDING_PROFILE_SYNC_VERSION,
} from '@/lib/profileSync'

describe('local profile cache', () => {
  it('makes a started cached profile available immediately', () => {
    const state = {
      ...createStartedHanaState('2026-08-14'),
      dailyEmotions: { '2026-08-14': 'good' as const },
      syncRevision: 7,
    }
    const storage = createStorage({
      'hana-game/v1': JSON.stringify(state),
    })

    const local = readLocalProfileState('hana', '2026-08-14', storage)

    expect(local?.source).toBe('cache')
    expect(local?.state.syncRevision).toBe(7)
    expect(readLocalProfileEmotion('hana', '2026-08-14', storage)).toBe(
      'good',
    )
  })

  it('prefers a pending device save over the ordinary cache', () => {
    const cached = {
      ...createStartedHanaState('2026-08-14'),
      dailyEmotions: { '2026-08-14': 'okay' as const },
      syncRevision: 4,
    }
    const pendingState = {
      ...cached,
      dailyEmotions: { '2026-08-14': 'bright' as const },
    }
    const storage = createStorage({
      'hana-game/v1': JSON.stringify(cached),
      [HANA_PENDING_STORAGE_KEY]: JSON.stringify({
        format: PENDING_PROFILE_SYNC_FORMAT,
        version: PENDING_PROFILE_SYNC_VERSION,
        state: pendingState,
        baseState: cached,
        writeToken: 'sync-local-first-test',
        queuedAt: '2026-08-14T05:00:00.000Z',
        attempted: false,
      }),
    })

    const local = readLocalProfileState('hana', '2026-08-14', storage)

    expect(local?.source).toBe('pending')
    expect(local?.state.dailyEmotions['2026-08-14']).toBe('bright')
    expect(local?.pending?.writeToken).toBe('sync-local-first-test')
  })

  it('does not present an unstarted or malformed cache as a ready profile', () => {
    const storage = createStorage({
      'hana-game/v1': '{bad-json',
    })

    expect(readLocalProfileState('hana', '2026-08-14', storage)).toBeNull()
  })
})

function createStorage(values: Record<string, string>) {
  return {
    getItem(key: string) {
      return values[key] ?? null
    },
  }
}
