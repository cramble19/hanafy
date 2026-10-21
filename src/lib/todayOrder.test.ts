import { describe, expect, it } from 'vitest'
import type { OpenActivity, RhythmSettings } from '@/types'
import { orderedIds, todaySections } from './todayOrder'
import { readRhythmSettings, changeRhythmCategory } from './rhythmCategories'
import { createStartedHanaState, parseStoredHanaState } from './hanaGame'
import { queuePendingProfileSync, rebasePendingProfileSync } from './profileSync'
import { crambleQuests } from '@/data/crambleQuests'
import { CRAMBLE_QUEST_PLAN_OPTIONS } from './crambleGame'

const activities: OpenActivity[] = ['a', 'b', 'c'].map(id => ({ id, title: id, description: '', color: 'blue', custom: true, kind: 'check', unit: null, createdDate: '2026-01-01' }))
const settings: RhythmSettings = { version: 1, categories: { care: 'Care', movement: 'Movement' }, assignments: { a: 'care', b: 'movement', c: null }, today: { sort: 'groups', groupOrder: ['movement', 'care'], habitOrder: ['c', 'b', 'a'] } }
describe('Today ordering', () => {
  it('groups using shared assignments, keeps Unsorted last and never drops new habits', () => {
    expect(todaySections(activities, settings, {}, '2026-10-21').map(s => [s.title, s.activities.map(a => a.id)])).toEqual([['Movement', ['b']], ['Care', ['a']], ['Unsorted', ['c']]])
    expect(orderedIds(['a', 'b', 'c'], ['b', 'deleted', 'b'])).toEqual(['b', 'a', 'c'])
  })
  it('defaults to existing order and retains manual order between modes', () => {
    expect(todaySections(activities, { ...settings, today: undefined }, {}, '2026-10-21')[0].activities).toEqual(activities)
    expect(todaySections(activities, { ...settings, today: { ...settings.today!, sort: 'manual' } }, {}, '2026-10-21')[0].activities.map(a => a.id)).toEqual(['c', 'b', 'a'])
  })
  it('counts recorded days, not repetitions, within inclusive 7/30 day windows', () => {
    const logs = { '2026-10-21': { a: 100, b: 1 }, '2026-10-15': { b: 1 }, '2026-10-14': { c: 1 }, '2026-09-22': { c: 1 }, '2026-09-21': { a: 1 }, '2026-10-22': { a: 1 } }
    expect(todaySections(activities, { ...settings, today: { ...settings.today!, sort: '7' } }, logs, '2026-10-21')[0].activities.map(a => a.id)).toEqual(['b', 'a', 'c'])
    expect(todaySections(activities, { ...settings, today: { ...settings.today!, sort: '30' } }, logs, '2026-10-21')[0].activities.map(a => a.id)).toEqual(['c', 'b', 'a'])
  })
  it('deleting groups preserves records and puts their habits in Unsorted', () => {
    const state = { ...createStartedHanaState('2026-10-21'), rhythm: settings }
    const result = changeRhythmCategory(state, { type: 'delete', id: 'care' }).state
    expect(result.openActivityLogs).toBe(state.openActivityLogs)
    expect(todaySections(activities, result.rhythm!, {}, state.currentDate).at(-1)!.activities.map(a => a.id)).toEqual(['c', 'a'])
  })
  it('validates orders and preserves settings through reload and concurrent synchronization', () => {
    expect(readRhythmSettings({ ...settings, today: { sort: 'manual', groupOrder: ['care', 'care', 7], habitOrder: null } })?.today).toEqual({ sort: 'manual', groupOrder: ['care'], habitOrder: [] })
    const base = { ...createStartedHanaState('2026-10-21'), rhythm: settings }
    const local = { ...base, rhythm: { ...settings, today: { ...settings.today!, sort: '7' as const } } }
    const remote = { ...base, openActivityLogs: { '2026-10-21': { a: 4 } }, rhythm: { ...settings, categories: { ...settings.categories, new: 'New' } } }
    const merged = rebasePendingProfileSync(queuePendingProfileSync(base, local, null), remote, 5)!.state
    const loaded = parseStoredHanaState(JSON.stringify(merged), crambleQuests, base.currentDate, CRAMBLE_QUEST_PLAN_OPTIONS)!
    expect(loaded.rhythm?.today?.sort).toBe('7')
    expect(loaded.rhythm?.categories.new).toBe('New')
    expect(merged.openActivityLogs).toEqual(remote.openActivityLogs)
  })
})
