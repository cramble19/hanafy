import { describe, expect, it } from 'vitest'
import { changeLifetime, lifetimeTotal } from './lifetime'
import { createStartedHanaState, parseStoredHanaState, resetProfileProgress, syncStateToDate } from './hanaGame'
import { CRAMBLE_QUEST_PLAN_OPTIONS } from './crambleGame'
import { crambleQuests } from '@/data/crambleQuests'
import { queuePendingProfileSync, rebasePendingProfileSync } from './profileSync'

const fixture = () => changeLifetime({ ...createStartedHanaState('2026-10-16'), totalFlowers: 23, dailyCompletions: { '2026-10-01': { old: true } } }, { type: 'save', title: 'Alcohol occasions', description: 'One session', startingTotal: 12 }).state
describe('Lifetime counters and retired Observatory', () => {
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
