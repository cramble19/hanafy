import { describe, expect, it, vi } from 'vitest'
import { createStartedHanaState, parseStoredHanaState } from '@/lib/hanaGame'
import { quests } from '@/data/quests'
import {
  addSomedayItem,
  deleteSomedayItem,
  getNewSomedayItemValidationError,
  toggleSomedayItem,
  updateSomedayItem,
} from '@/lib/someday'

describe('Someday life wishes', () => {
  it('adds timeless and age-based items without touching tracker progress', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'wish-1' })
    const base = {
      ...createStartedHanaState('2026-08-29'),
      totalFlowers: 17,
    }
    const timeless = addSomedayItem(base, {
      title: 'See cherry blossoms in Japan',
      timing: 'timeless',
    })
    expect(timeless.error).toBeNull()
    const ageBased = addSomedayItem(timeless.state, {
      title: 'Learn to swim',
      timing: 'beforeAge',
      targetAge: 35,
    })

    expect(ageBased.error).toBeNull()
    expect(ageBased.state.somedayItems).toEqual([
      expect.objectContaining({
        title: 'See cherry blossoms in Japan',
        timing: 'timeless',
        targetAge: null,
        completedDate: null,
      }),
      expect.objectContaining({
        title: 'Learn to swim',
        timing: 'beforeAge',
        targetAge: 35,
        completedDate: null,
      }),
    ])
    expect(ageBased.state.totalFlowers).toBe(17)
    vi.unstubAllGlobals()
  })

  it('keeps completed items and records the logical completion date', () => {
    const added = addSomedayItem(createStartedHanaState('2026-08-29'), {
      title: 'Take dad to the mountains',
      timing: 'timeless',
    }).state
    const itemId = added.somedayItems?.[0].id as string
    const completed = toggleSomedayItem(added, itemId)
    expect(completed.somedayItems?.[0]).toEqual(expect.objectContaining({
      id: itemId,
      completedDate: '2026-08-29',
    }))
    expect(toggleSomedayItem(completed, itemId).somedayItems?.[0].completedDate).toBeNull()
  })

  it('edits timing without changing identity or completion history', () => {
    const completed = toggleSomedayItem(
      addSomedayItem(createStartedHanaState('2026-08-29'), {
        title: 'Learn pottery',
        timing: 'timeless',
      }).state,
      'missing',
    )
    const itemId = completed.somedayItems?.[0].id as string
    const stateWithMemory = toggleSomedayItem(completed, itemId)
    const result = updateSomedayItem(stateWithMemory, itemId, {
      title: 'Learn wheel pottery',
      timing: 'beforeAge',
      targetAge: 38,
    })

    expect(result.error).toBeNull()
    expect(result.state.somedayItems?.[0]).toEqual(expect.objectContaining({
      id: itemId,
      title: 'Learn wheel pottery',
      timing: 'beforeAge',
      targetAge: 38,
      createdDate: '2026-08-29',
      completedDate: '2026-08-29',
    }))
  })

  it('validates edits against other items and deletes only the selected item', () => {
    const first = addSomedayItem(createStartedHanaState('2026-08-29'), {
      title: 'Learn pottery',
      timing: 'timeless',
    }).state
    const second = addSomedayItem(first, {
      title: 'See the northern lights',
      timing: 'timeless',
    }).state
    const [firstItem, secondItem] = second.somedayItems ?? []

    expect(updateSomedayItem(second, secondItem.id, {
      title: ' learn pottery ',
      timing: 'timeless',
    }).error).toBe('That is already in Someday.')

    const deleted = deleteSomedayItem(second, firstItem.id)
    expect(deleted.somedayItems).toEqual([secondItem])
    expect(deleteSomedayItem(deleted, 'missing')).toBe(deleted)
  })

  it('migrates older snapshots without losing existing data', () => {
    const legacy = createStartedHanaState('2026-08-29')
    delete legacy.somedayItems
    legacy.schemaVersion = 6
    const migrated = parseStoredHanaState(
      JSON.stringify(legacy),
      quests,
      '2026-08-29',
    )
    expect(migrated?.schemaVersion).toBe(7)
    expect(migrated?.somedayItems).toEqual([])
    expect(migrated?.currentDate).toBe('2026-08-29')
  })

  it('validates ages and duplicate titles', () => {
    expect(getNewSomedayItemValidationError({
      title: 'Run a half marathon',
      timing: 'beforeAge',
      targetAge: 0,
    })).toContain('whole age')
    expect(getNewSomedayItemValidationError({
      title: ' Run a half marathon ',
      timing: 'timeless',
    }, [{
      id: 'existing',
      title: 'run a half marathon',
      timing: 'beforeAge',
      targetAge: 40,
      createdDate: '2026-08-29',
      completedDate: null,
    }])).toBe('That is already in Someday.')
  })
})
