import { describe, expect, it } from 'vitest'
import { changeLifetime, lifetimeTotal, readLifetimeCounters } from './lifetime'
import { createStartedHanaState, parseStoredHanaState, resetProfileProgress, syncStateToDate } from './hanaGame'
import { CRAMBLE_QUEST_PLAN_OPTIONS } from './crambleGame'
import { crambleQuests } from '@/data/crambleQuests'
import { queuePendingProfileSync, rebasePendingProfileSync } from './profileSync'

const fixture = () => changeLifetime({ ...createStartedHanaState('2026-10-16'), totalFlowers: 23, dailyCompletions: { '2026-10-01': { old: true } } }, { type: 'save', title: 'Alcohol occasions', description: 'One session', startingTotal: 12 }).state
describe('Lifetime counters and retired Observatory', () => {
  it('edits the exact entry while preserving amounts, baseline and other records', () => {
    const base = fixture(), id = base.lifetimeCounters![0].id
    const recorded = changeLifetime(base, { type: 'record', id, date: base.currentDate, entryId: 'first' }).state
    const original = changeLifetime(recorded, { type: 'record', id, date: base.currentDate, entryId: 'second', note: 'Keep me' }).state
    const result = changeLifetime(original, { type: 'edit-entry', id, entryId: 'first', date: '2025-10-01', note: ' Vietnam ' })
    expect(result.error).toBeNull()
    expect(result.state.lifetimeCounters![0].entries).toEqual([{ id: 'first', amount: 1, date: '2025-10-01', note: 'Vietnam' }, original.lifetimeCounters![0].entries[1]])
    expect(lifetimeTotal(result.state.lifetimeCounters![0])).toBe(14)
    expect(result.state.dailyCompletions).toBe(original.dailyCompletions)
    expect(result.state.lifetimeCounters![0].startingTotal).toBe(12)
    const cleared = changeLifetime(result.state, { type: 'edit-entry', id, entryId: 'first', date: '2025-10-01', note: '' })
    expect(cleared.state.lifetimeCounters![0].entries[0].note).toBe('')
    expect(readLifetimeCounters(cleared.state.lifetimeCounters)).toEqual(cleared.state.lifetimeCounters)
  })
  it('rejects invalid edits and missing entries without changing data', () => {
    const base = fixture(), id = base.lifetimeCounters![0].id
    const state = changeLifetime(base, { type: 'record', id, date: base.currentDate, entryId: 'entry' }).state
    for (const date of ['2026-10-17', '2026-02-30', 'bad']) {
      const result = changeLifetime(state, { type: 'edit-entry', id, entryId: 'entry', date, note: '' })
      expect(result.error).toBeTruthy()
      expect(result.state).toBe(state)
    }
    for (const [entryId, note] of [['missing', ''], ['entry', 'x'.repeat(2001)]]) {
      const result = changeLifetime(state, { type: 'edit-entry', id, entryId, date: base.currentDate, note })
      expect(result.error).toBeTruthy()
      expect(result.state).toBe(state)
    }
  })
  it('preserves an entry edit alongside a concurrent new record through sync and reload', () => {
    const initial = fixture(), id = initial.lifetimeCounters![0].id
    const base = changeLifetime(initial, { type: 'record', id, date: initial.currentDate, entryId: 'entry' }).state
    const local = changeLifetime(base, { type: 'edit-entry', id, entryId: 'entry', date: '2025-10-01', note: 'Vietnam' }).state
    const remote = changeLifetime(base, { type: 'record', id, date: base.currentDate, entryId: 'new' }).state
    const merged = rebasePendingProfileSync(queuePendingProfileSync(base, local, null), remote, 5)!.state
    const loaded = parseStoredHanaState(JSON.stringify(merged), crambleQuests, base.currentDate, CRAMBLE_QUEST_PLAN_OPTIONS)!
    expect(loaded.lifetimeCounters![0].entries).toContainEqual({ id: 'entry', date: '2025-10-01', amount: 1, note: 'Vietnam' })
    expect(loaded.lifetimeCounters![0].entries).toHaveLength(2)
    expect(lifetimeTotal(loaded.lifetimeCounters![0])).toBe(14)
  })
  it('adds starting context to an existing total without inventing dates or changing records', () => {
    const base = fixture(), counter = base.lifetimeCounters![0]
    const state = changeLifetime(base, { type: 'save', id: counter.id, title: counter.title, description: counter.description, startingTotal: 12, startingDescription: ' Estimated before tracking ' }).state
    expect(state.lifetimeCounters![0].startingDescription).toBe('Estimated before tracking')
    expect(state.lifetimeCounters![0].entries).toEqual([])
    expect(lifetimeTotal(state.lifetimeCounters![0])).toBe(12)
    const renamed = changeLifetime(state, { type: 'save', id: counter.id, title: 'Renamed', description: '', startingTotal: 12 }).state
    expect(renamed.lifetimeCounters![0].startingDescription).toBe('Estimated before tracking')
    expect(readLifetimeCounters(base.lifetimeCounters)).toEqual(base.lifetimeCounters)
  })
  it('persists individual notes and baseline context through reload and concurrent synchronization', () => {
    const base = fixture(), counter = base.lifetimeCounters![0]
    const local = changeLifetime(base, { type: 'record', id: counter.id, date: '2026-10-16', entryId: 'noted', note: ' Birthday dinner ' }).state
    const remote = changeLifetime(base, { type: 'save', id: counter.id, title: counter.title, description: counter.description, startingTotal: 12, startingDescription: 'Earlier occasions' }).state
    const merged = rebasePendingProfileSync(queuePendingProfileSync(base, local, null), remote, 5)!.state
    const loaded = parseStoredHanaState(JSON.stringify(merged), crambleQuests, base.currentDate, CRAMBLE_QUEST_PLAN_OPTIONS)!
    expect(loaded.lifetimeCounters![0].startingDescription).toBe('Earlier occasions')
    expect(loaded.lifetimeCounters![0].entries[0].note).toBe('Birthday dinner')
    expect(lifetimeTotal(loaded.lifetimeCounters![0])).toBe(13)
    const repeated = changeLifetime(loaded, { type: 'record', id: counter.id, date: '2026-10-16', entryId: 'noted', note: 'Birthday dinner' }).state
    expect(repeated).toBe(loaded)
  })
  it('rejects oversized notes without changing totals and permits empty notes', () => {
    const base = fixture(), counter = base.lifetimeCounters![0]
    expect(changeLifetime(base, { type: 'record', id: counter.id, date: base.currentDate, note: 'x'.repeat(2001) }).state).toBe(base)
    expect(changeLifetime(base, { type: 'save', id: counter.id, title: counter.title, description: '', startingTotal: 12, startingDescription: 'x'.repeat(2001) }).state).toBe(base)
    expect(changeLifetime(base, { type: 'record', id: counter.id, date: base.currentDate, note: '' }).error).toBeNull()
  })
  it('records repeated dates, corrects starting totals, and undoes the exact occurrence', () => {
    const original = fixture(), id = original.lifetimeCounters![0].id
    let state = changeLifetime(original, { type: 'record', id, date: '2026-10-16', entryId: 'first' }).state
    state = changeLifetime(state, { type: 'record', id, date: '2026-10-16', entryId: 'second' }).state
    expect(lifetimeTotal(state.lifetimeCounters![0])).toBe(14)
    state = changeLifetime(state, { type: 'undo', id, entryId: 'first' }).state
    expect(state.lifetimeCounters![0].entries.map(entry => entry.id)).toEqual(['second'])
    state = changeLifetime(state, { type: 'save', id, title: 'Renamed', description: '', startingTotal: 20 }).state
    expect(lifetimeTotal(state.lifetimeCounters![0])).toBe(21)
    expect(state.dailyCompletions).toEqual(original.dailyCompletions)
    expect(state.totalFlowers).toBe(23)
  })
  it('rejects invalid totals and dates without mutating state', () => {
    const state = fixture(), id = state.lifetimeCounters![0].id
    for (const value of [-1, 1.5, NaN, Infinity]) expect(changeLifetime(state, { type: 'save', id, title: 'Test', description: '', startingTotal: value }).state).toBe(state)
    for (const date of ['2026-10-17', '2026-02-30', 'bad']) expect(changeLifetime(state, { type: 'record', id, date }).error).toBeTruthy()
  })
  it('survives reload, reset and rollover while preserving lesson history/rewards', () => {
    const state = fixture()
    const loaded = parseStoredHanaState(JSON.stringify(state), crambleQuests, state.currentDate, CRAMBLE_QUEST_PLAN_OPTIONS)!
    expect(loaded.lifetimeCounters).toEqual(state.lifetimeCounters)
    expect(loaded.totalFlowers).toBe(23)
    const next = syncStateToDate(loaded, crambleQuests, '2026-11-16', CRAMBLE_QUEST_PLAN_OPTIONS)
    expect({ ...next, currentDate: loaded.currentDate }).toEqual(loaded)
    expect(resetProfileProgress(loaded, crambleQuests, CRAMBLE_QUEST_PLAN_OPTIONS).lifetimeCounters).toEqual(state.lifetimeCounters)
  })
  it('retains concurrent records from different devices', () => {
    const base = fixture(), id = base.lifetimeCounters![0].id
    const local = changeLifetime(base, { type: 'record', id, date: '2026-10-16', entryId: 'local' }).state
    const remote = changeLifetime(base, { type: 'record', id, date: '2026-10-15', entryId: 'remote' }).state
    const merged = rebasePendingProfileSync(queuePendingProfileSync(base, local, null), remote, 5)!
    expect(lifetimeTotal(merged.state.lifetimeCounters![0])).toBe(14)
    expect(merged.state.lifetimeCounters![0].entries).toHaveLength(2)
  })
})
