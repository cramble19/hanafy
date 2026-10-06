import { describe, expect, it } from 'vitest'
import { crambleQuests } from '@/data/crambleQuests'
import { quests as hanaQuests } from '@/data/quests'
import { createStartedHanaState, parseStoredHanaState, resetProfileProgress } from '@/lib/hanaGame'
import { assignRhythmCategory, createRhythmCategory, getRhythmSettings, readRhythmSettings } from './rhythmCategories'
import { categoryRecordedDays, getRhythmDates, getRhythmTrackers, sortRhythmTrackers } from './rhythmStats'
import { queuePendingProfileSync, rebasePendingProfileSync } from './profileSync'
import { createDefaultHabitSettings } from './habitLifecycle'
import type { GameState, OpenActivity } from '@/types'

const titles = ['Gym', 'Gym Hana', 'Push-ups', 'Badminton', 'Swimming', 'Table Tennis', 'Shampoo', 'Conditioner', 'Brush Twice', 'Journal', 'Chess', 'Play Halimba', 'Chinese', 'Talk to parents', 'Football', 'Training Yard', 'Coffee-dick-tion']
function fixture(): GameState {
  const state = createStartedHanaState('2026-09-01')
  state.currentDate = '2026-10-06'
  state.openActivities = titles.map((title, i): OpenActivity => ({id:`open-${i}`, title, custom:true, description:'A recorded activity', color:'#ffffff', kind:i===2?'count':'check', unit:null, createdDate:'2026-09-01'}))
  state.openActivityLogs = { '2026-10-01': { 'open-2':40, 'open-3':1 }, '2026-10-05': { 'open-3':1 }, '2026-09-15': { 'open-6':1 } }
  state.dailyEmotions = { '2026-10-06': 'good' }
  state.somedayItems = [{ id:'wish', title:'Travel', timing:'timeless', targetAge:null, createdDate:'2026-09-01', completedDate:null }]
  return state
}
function seeded() { const state=fixture();return { ...state, rhythm:getRhythmSettings(state,state.openActivities) } }

describe('Cramble Rhythm categories and history safety', () => {
  it('seeds only the named tasks, includes both gyms, and keeps Connection empty', () => {
    const state=seeded()
    expect(state.openActivities.slice(0,6).map(i=>state.rhythm.assignments[i.id])).toEqual(Array(6).fill('movement'))
    expect(state.openActivities.slice(6,9).map(i=>state.rhythm.assignments[i.id])).toEqual(Array(3).fill('care'))
    expect(state.openActivities.slice(9,13).map(i=>state.rhythm.assignments[i.id])).toEqual(Array(4).fill('mind-play'))
    expect(state.openActivities.slice(13).map(i=>state.rhythm.assignments[i.id])).toEqual(Array(4).fill(null))
    expect(state.rhythm.categories.connection).toBe('Connection')
  })
  it('creates and reassigns without changing any definitions, logs, wishes or emotions', () => {
    const state=seeded(), before=structuredClone(state)
    const created=createRhythmCategory(state,'  Learning  ','area-learning')
    expect(created.error).toBeNull()
    const moved=assignRhythmCategory(created.state,'open-12',created.id)
    const { rhythm, ...rest }=moved.state
    const { rhythm: original, ...oldRest }=before
    expect(rest).toEqual(oldRest)
    expect(rhythm?.assignments['open-12']).toBe('area-learning')
    expect(state.rhythm).toEqual(original)
    expect(moved.state.openActivityLogs).toBe(state.openActivityLogs)
  })
  it('retains explicit Unsorted and does not seed renamed or newly added tasks again', () => {
    const state=assignRhythmCategory(seeded(),'open-0',null).state
    state.openActivities=[...state.openActivities,{...state.openActivities[0],id:'new-gym'}]
    const result=getRhythmSettings(state,state.openActivities)
    expect(result.assignments['open-0']).toBeNull()
    expect(result.assignments['new-gym']).toBeUndefined()
  })
  it('validates blank, duplicate, reserved and overlong category names', () => {
    for(const name of ['', ' CARE ', 'Unsorted', 'a'.repeat(41)]) expect(createRhythmCategory(seeded(),name).error).toBeTruthy()
    expect(assignRhythmCategory(seeded(),'open-0','missing').error).toBeTruthy()
    expect(createRhythmCategory(seeded(),'Learning','__proto__').error).toBeTruthy()
  })
  it('roundtrips grouping through the existing parser and keeps it through a progress reset', () => {
    const state=seeded()
    const restored=parseStoredHanaState(JSON.stringify(state),crambleQuests,state.currentDate)
    expect(restored.rhythm).toEqual(state.rhythm)
    expect(restored.openActivityLogs).toEqual(state.openActivityLogs)
    expect(resetProfileProgress(restored,crambleQuests).rhythm).toEqual(state.rhythm)
  })
  it('does not add any Rhythm metadata to Hana', () => {
    const state=fixture()
    expect(parseStoredHanaState(JSON.stringify(state),hanaQuests,state.currentDate).rhythm).toBeUndefined()
  })
  it('handles malformed optional metadata without touching other state', () => {
    expect(readRhythmSettings(null)).toBeUndefined()
    expect(readRhythmSettings({version:1,categories:{movement:'Movement'},assignments:{a:'missing',b:null,c:'movement'}})?.assignments).toEqual({a:null,b:null,c:'movement'})
  })
  it('merges category changes with another device’s new logs', () => {
    const base=seeded(), local=assignRhythmCategory(base,'open-0','care').state
    const remote={...base,openActivityLogs:{...base.openActivityLogs,'2026-10-06':{'open-1':1}},rhythm:{...base.rhythm,assignments:{...base.rhythm.assignments,'open-3':'mind-play'}}}
    const rebased=rebasePendingProfileSync(queuePendingProfileSync(base,local,null),remote,10)
    expect(rebased?.state.openActivityLogs).toEqual(remote.openActivityLogs)
    expect(rebased?.state.rhythm?.assignments['open-0']).toBe('care')
    expect(rebased?.state.rhythm?.assignments['open-3']).toBe('mind-play')
  })
  it('merges independently created categories rather than replacing the list', () => {
    const base=seeded(),local=createRhythmCategory(base,'Learning','area-learning').state
    const remote=createRhythmCategory(base,'Home','area-home').state
    const result=rebasePendingProfileSync(queuePendingProfileSync(base,local,null),remote,10)
    expect(result?.state.rhythm?.categories).toMatchObject({'area-learning':'Learning','area-home':'Home'})
  })
})

describe('Rhythm recorded-day ribbons', () => {
  it('ranks distinct days rather than quantity and unions category days', () => {
    const state=fixture(),trackers=getRhythmTrackers(state,crambleQuests),dates=getRhythmDates(state.currentDate,30)
    expect(trackers).toHaveLength(titles.length)
    expect(sortRhythmTrackers(trackers,dates)[0].title).toBe('Badminton')
    expect(trackers.find(i=>i.title==='Push-ups')?.dates).toHaveLength(1)
    expect(categoryRecordedDays(trackers.filter(i=>['Push-ups','Badminton'].includes(i.title)),dates)).toEqual(['2026-10-01','2026-10-05'])
    expect(getRhythmDates(state.currentDate,7)).toEqual(['2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06'])
  })
  it('excludes archived, deleted and future trackers but keeps paused history neutral', () => {
    const state=fixture()
    state.habitSettings={'open-0':{...createDefaultHabitSettings(),archivedAt:'2026-10-01'},'open-3':{...createDefaultHabitSettings(),pauses:[{id:'p',startDate:'2026-10-01',endDate:null,reason:'rest',recordedAt:'2026-10-01'}]}}
    state.deletedHabitIds=['open-1'];state.openActivities[2].createdDate='2026-11-01'
    const trackers=getRhythmTrackers(state,crambleQuests)
    expect(trackers.map(i=>i.id)).not.toContain('open-0')
    expect(trackers.map(i=>i.id)).not.toContain('open-1')
    expect(trackers.map(i=>i.id)).not.toContain('open-2')
    expect(trackers.find(i=>i.id==='open-3')).toMatchObject({paused:true,dates:['2026-10-01','2026-10-05']})
  })
  it('keeps Observatory lessons out of Rhythm without changing their records', () => {
    const state=fixture();state.questActivations={'training-yard':'2026-09-01'}
    state.habitOccurrences={'2026-10-01':{'training-yard':3}}
    state.dailyCompletions={'2026-10-01':{'training-yard':true}}
    const tracker=getRhythmTrackers(state,crambleQuests).find(i=>i.id==='training-yard')
    expect(tracker).toBeUndefined()
    expect(state.habitOccurrences['2026-10-01']['training-yard']).toBe(3)
    expect(state.dailyCompletions['2026-10-01']['training-yard']).toBe(true)
  })
})
