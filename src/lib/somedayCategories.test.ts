import { describe, expect, it } from 'vitest'
import { createStartedHanaState, parseStoredHanaState, resetProfileProgress } from './hanaGame'
import { quests } from '@/data/quests'
import { assignSomedayCategory, changeSomedayCategory, getSomedayCategories, readSomedayCategories } from './somedayCategories'
import { addSomedayItem, updateSomedayItem } from './someday'
import { INITIAL_SOMEDAY_ASSIGNMENTS } from '@/data/somedayCategories'

function fixture() {
  return { ...createStartedHanaState('2026-10-08'), somedayItems: [
    { id: 'wish', title: 'Learn pottery', timing: 'beforeAge' as const, targetAge: 35, createdDate: '2026-09-01', completedDate: null },
    { id: 'memory', title: 'See Japan', timing: 'timeless' as const, targetAge: null, createdDate: '2026-08-01', completedDate: '2026-09-25' },
  ] }
}
describe('Someday categories', () => {
  it('seeds only approved IDs, not titles or new entries', () => {
    const base = fixture()
    const [id, category] = Object.entries(INITIAL_SOMEDAY_ASSIGNMENTS)[0]
    base.somedayItems[0].id = id
    expect(getSomedayCategories(base).assignments).toEqual({ [id]: category, memory: null })
    expect(base).not.toHaveProperty('somedayCategories')
  })
  it('can categorize a memory without changing any entries or habit records', () => {
    const base = fixture()
    const result = assignSomedayCategory(base, 'memory', 'travel')
    expect(result.error).toBeNull()
    expect(result.state.somedayItems).toBe(base.somedayItems)
    expect(result.state.openActivityLogs).toBe(base.openActivityLogs)
    expect(result.state.rhythm).toBe(base.rhythm)
    expect(result.state.somedayCategories?.assignments.memory).toBe('travel')
    expect(assignSomedayCategory(base, 'memory', 'missing').state).toBe(base)
    expect(assignSomedayCategory(base, 'missing', 'travel').error).toBeTruthy()
  })
  it('creates, renames, and deletes without deleting memories or reseeding', () => {
    const base = fixture()
    const created = changeSomedayCategory(base, { type: 'create', name: ' Little joys ' })
    expect(created.error).toBeNull()
    const id = Object.keys(created.state.somedayCategories!.categories).find(id => id.startsWith('category-'))!
    const assigned = assignSomedayCategory(created.state, 'memory', id).state
    const renamed = changeSomedayCategory(assigned, { type: 'rename', id, name: 'Joy' }).state
    expect(renamed.somedayCategories!.assignments.memory).toBe(id)
    const deleted = changeSomedayCategory(renamed, { type: 'delete', id }).state
    expect(deleted.somedayItems).toBe(base.somedayItems)
    expect(getSomedayCategories(deleted).assignments.memory).toBeNull()
    expect(getSomedayCategories(deleted).categories).not.toHaveProperty(id)
    expect(changeSomedayCategory(base, { type: 'create', name: 'Unsorted' }).error).toBeTruthy()
    expect(changeSomedayCategory(base, { type: 'create', name: ' travel & experiences ' }).error).toBeTruthy()
    expect(changeSomedayCategory(base, { type: 'create', name: ' ' }).error).toBeTruthy()
    expect(changeSomedayCategory(base, { type: 'rename', id: 'travel', name: 'Love & Family' }).error).toBeTruthy()
  })
  it('survives serialization, reload, completion-preserving edits and progress reset', () => {
    const base = assignSomedayCategory(fixture(), 'memory', 'travel').state
    const edited = updateSomedayItem(base, 'memory', { title: 'A journey in Japan', timing: 'beforeAge', targetAge: 40 }).state
    const restored = parseStoredHanaState(JSON.stringify(edited), quests, '2026-10-08')!
    expect(restored.somedayCategories).toEqual(base.somedayCategories)
    expect(restored.somedayItems![1].completedDate).toBe('2026-09-25')
    expect(restored.somedayItems![1].createdDate).toBe('2026-08-01')
    expect(resetProfileProgress(restored, quests).somedayCategories).toEqual(base.somedayCategories)
  })
  it('keeps deliberately empty categories empty and sanitizes malformed metadata', () => {
    expect(readSomedayCategories({ version: 1, categories: {}, assignments: { memory: 'gone' } })).toEqual({ version: 1, categories: {}, assignments: { memory: null } })
    expect(readSomedayCategories(null)).toBeUndefined()
    const empty = { ...fixture(), somedayCategories: { version: 1 as const, categories: {}, assignments: { memory: null } } }
    expect(getSomedayCategories(empty)).toBe(empty.somedayCategories)
    expect(addSomedayItem(empty, { title: 'New wish', timing: 'timeless' }).state.somedayCategories).toBe(empty.somedayCategories)
  })
})
