import { describe, expect, it } from 'vitest'

import { createInitialHanaState } from '@/lib/hanaGame'
import {
  advancePendingProfileSyncRevision,
  markPendingProfileSyncAttempted,
  parsePendingProfileSync,
  queuePendingProfileSync,
  rebasePendingProfileSync,
  serializePendingProfileSync,
} from '@/lib/profileSync'

describe('profile sync outbox', () => {
  it('persists a stable token for an unchanged retry and rotates it after edits', () => {
    const base = startedState()
    const first = queuePendingProfileSync(base, {
      ...base,
      dailyEmotions: { '2026-08-10': 'good' },
    }, null, '2026-08-10T12:00:00.000Z')
    const attempted = markPendingProfileSyncAttempted(first)
    const edited = queuePendingProfileSync(attempted.state, {
      ...attempted.state,
      dailyEmotions: { '2026-08-10': 'bright' },
    }, attempted)

    expect(markPendingProfileSyncAttempted(attempted).writeToken).toBe(
      attempted.writeToken,
    )
    expect(edited.writeToken).not.toBe(attempted.writeToken)
    expect(edited.baseState).toEqual(base)
  })

  it('round-trips envelopes and migrates legacy state-only pending caches', () => {
    const base = startedState()
    const pending = queuePendingProfileSync(base, {
      ...base,
      dailyEmotions: { '2026-08-10': 'good' },
    }, null)
    const parseState = (raw: string) => JSON.parse(raw) as typeof base

    expect(
      parsePendingProfileSync(serializePendingProfileSync(pending), parseState),
    ).toMatchObject({ writeToken: pending.writeToken, state: pending.state })
    expect(parsePendingProfileSync(JSON.stringify(pending.state), parseState))
      .toMatchObject({ baseState: null, state: pending.state })
  })

  it('three-way rebases local changes without dropping remote-only changes', () => {
    const base = startedState()
    const local = {
      ...base,
      dailyCompletions: {
        '2026-08-10': { water: false, localOnly: true },
      },
      dailyEmotions: { '2026-08-10': 'good' as const },
    }
    const remote = {
      ...base,
      syncRevision: 4,
      dailyCompletions: {
        '2026-08-10': { water: true, remoteOnly: true },
      },
      openActivityLogs: { '2026-08-10': { reading: 2 } },
    }
    const pending = queuePendingProfileSync(base, local, null)
    const rebased = rebasePendingProfileSync(pending, remote, 4)

    expect(rebased?.state.dailyCompletions['2026-08-10']).toEqual({
      water: false,
      localOnly: true,
      remoteOnly: true,
    })
    expect(rebased?.state.openActivityLogs).toEqual(remote.openActivityLogs)
    expect(rebased?.state.dailyEmotions['2026-08-10']).toBe('good')
    expect(rebased?.state.syncRevision).toBe(4)
    expect(rebased?.baseState?.syncRevision).toBe(4)
  })

  it('keeps both sides when migrating a legacy pending cache', () => {
    const remote = {
      ...startedState(),
      dailyCompletions: { '2026-08-10': { remoteOnly: true } },
    }
    const local = {
      ...startedState(),
      dailyCompletions: { '2026-08-10': { localOnly: true } },
    }
    const parseState = (raw: string) => JSON.parse(raw) as typeof local
    const legacy = parsePendingProfileSync(JSON.stringify(local), parseState)
    const rebased = legacy && rebasePendingProfileSync(legacy, remote, 2)

    expect(rebased?.state.dailyCompletions['2026-08-10']).toEqual({
      remoteOnly: true,
      localOnly: true,
    })
  })

  it('advances a queued successor after the prior write is acknowledged', () => {
    const base = startedState()
    const pending = queuePendingProfileSync(base, {
      ...base,
      dailyEmotions: { '2026-08-10': 'good' },
    }, null)
    const advanced = advancePendingProfileSyncRevision(pending, 0, 1)
    expect(advanced.state.syncRevision).toBe(1)
    expect(advanced.baseState?.syncRevision).toBe(1)
  })
})

function startedState() {
  return {
    ...createInitialHanaState(),
    startDate: '2026-08-06',
    currentDate: '2026-08-10',
    syncRevision: 0,
  }
}
