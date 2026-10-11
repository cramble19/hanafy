import { describe, expect, it } from 'vitest'
import { changeRhythmCategory, getRhythmSettings } from './rhythmCategories'
import { createStartedHanaState } from './hanaGame'

function fixture() {
  const state = createStartedHanaState('2026-10-12')
  return { ...state, rhythm: { ...getRhythmSettings(state, []), assignments: { a: 'care', b: 'movement' } }, openActivityLogs: { '2026-10-12': { a: 12 } } }
}
describe('Habit category management', () => {
  it('renames metadata without changing assignment IDs or any history', () => {
    const state = fixture(), result = changeRhythmCategory(state, { type: 'rename', id: 'care', name: 'Personal care' })
    expect(result.error).toBeNull()
    expect(result.state.rhythm?.categories.care).toBe('Personal care')
    expect(result.state.rhythm?.assignments).toEqual(state.rhythm.assignments)
    expect(result.state.openActivityLogs).toBe(state.openActivityLogs)
  })
  it('moves only deleted-category members to Unsorted and preserves the complete source state', () => {
    const state = fixture(), before = JSON.stringify(state)
    const result = changeRhythmCategory(state, { type: 'delete', id: 'care' })
    expect(result.error).toBeNull()
    expect(result.state.rhythm?.categories.care).toBeUndefined()
    expect(result.state.rhythm?.assignments).toEqual({ a: null, b: 'movement' })
    expect({ ...result.state, rhythm: state.rhythm }).toEqual(state)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('rejects duplicates, reserved names, blank names and stale IDs', () => {
    for (const name of [' Movement ', 'Unsorted', '', 'a'.repeat(41)]) expect(changeRhythmCategory(fixture(), { type: 'rename', id: 'care', name }).error).toBeTruthy()
    expect(changeRhythmCategory(fixture(), { type: 'delete', id: 'missing' }).error).toBeTruthy()
  })
})
