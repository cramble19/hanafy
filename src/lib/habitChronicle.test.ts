import { describe, expect, it } from 'vitest'
import type { HanaGameState, OpenActivity, Quest } from '@/types'
import { buildProfileChronicleHtml } from './habitChronicle'

describe('habit chronicle HTML export', () => {
  it('builds an escaped Cramble chronicle and excludes never-unlocked future quests', () => {
    const active = createDailyQuest({
      id: 'active-habit',
      title: 'Train <script>alert("x")</script>',
      description: 'Move safely & steadily.',
    })
    const paused = createDailyQuest({ id: 'paused-habit', title: 'Evening read' })
    const archived = createDailyQuest({
      id: 'archived-habit',
      title: 'Old road',
      minLevel: 99,
    })
    const future = createDailyQuest({
      id: 'future-habit',
      title: 'Secret future quest',
      minLevel: 99,
    })
    const state = createState({
      currentDate: '2026-08-06',
      activeDailyQuests: {
        '2026-08-01': [active.id, paused.id, archived.id],
        '2026-08-06': [active.id, paused.id],
      },
      dailyCompletions: {
        '2026-08-01': {
          [active.id]: true,
          [archived.id]: true,
        },
      },
      habitSettings: {
        [paused.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: null,
          pauses: [
            {
              id: 'private-pause',
              startDate: '2026-08-06',
              endDate: null,
              reason: 'illness',
              note: 'PRIVATE RECOVERY DETAIL',
              recordedAt: '2026-08-06T08:00:00.000Z',
            },
          ],
        },
        [archived.id]: {
          cue: '',
          reminder: { enabled: false, time: null },
          archivedAt: '2026-08-02',
          pauses: [],
        },
      },
    })

    const html = buildProfileChronicleHtml(
      state,
      [active, paused, archived, future],
      'cramble',
      '2026-08-07T10:30:00.000Z',
    )

    expect(html).toContain('The Sunward Chronicle')
    expect(html).toContain('Train &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('Move safely &amp; steadily.')
    expect(html).toContain('Evening read')
    expect(html).toContain('Old road')
    expect(html).toContain('archived · since Aug 2, 2026')
    expect(html).not.toContain('Secret future quest')
    expect(html).not.toContain('PRIVATE RECOVERY DETAIL')
    expect(html).not.toContain('illness')
    expect(html).toContain('Tracking day: 4:00 AM–3:59 AM next day')
    expect(html).toContain('class="period completed"')
    expect(html).toContain('class="habit paused"')
  })

  it('uses Hana styling and preserves count progress for flexible goal windows', () => {
    const habit: Quest = {
      ...createDailyQuest({ id: 'three-times', title: 'Three bright steps' }),
      schedule: {
        kind: 'periodTarget',
        target: 3,
        periodDays: 10,
        anchor: 'questStart',
      },
      createdDate: '2026-07-01',
    }
    const state = createState({
      startDate: '2026-07-01',
      currentDate: '2026-07-25',
      habitOccurrences: {
        '2026-07-01': { [habit.id]: 3 },
        '2026-07-12': { [habit.id]: 2 },
        '2026-07-22': { [habit.id]: 1 },
      },
    })

    const html = buildProfileChronicleHtml(
      state,
      [habit],
      'hana',
      new Date('2026-08-07T10:30:00.000Z'),
    )

    expect(html).toContain('The Garden Record')
    expect(html).toContain('3 times every 10 days')
    expect(html).toContain('3 / 3')
    expect(html).toContain('2 / 3')
    expect(html).toContain('1 / 3')
    expect(html).toContain('class="period completed"')
    expect(html).toContain('class="period missed"')
    expect(html).toContain('class="period open"')
    expect(html).toContain('Personal pause reasons and notes are intentionally excluded')
  })

  it('renders deadline-free activity as factual records with neutral blank days', () => {
    const activity: OpenActivity = {
      id: 'open-pages',
      custom: true,
      title: 'Pages <read>',
      description: 'Record pages & keep going.',
      emoji: '📖',
      color: '#8ba07b',
      kind: 'count',
      unit: 'pages',
      createdDate: '2026-08-01',
    }
    const state = createState({
      currentDate: '2026-08-04',
      openActivities: [activity],
      openActivityLogs: {
        '2026-08-01': { [activity.id]: 12 },
        '2026-08-03': { [activity.id]: 8 },
      },
    })

    const html = buildProfileChronicleHtml(
      state,
      [],
      'hana',
      '2026-08-04T12:00:00.000Z',
    )

    expect(html).toContain('Anytime records')
    expect(html).toContain('Pages &lt;read&gt;')
    expect(html).toContain('Record pages &amp; keep going.')
    expect(html).toContain('20')
    expect(html).toContain('12 pages')
    expect(html).toContain('8 pages')
    expect(html).toContain('Blank days are neutral and omitted')
    expect(html).toContain('None</strong><span>Rewards')
    expect(html).not.toContain('class="period missed"')
  })
})

function createDailyQuest(
  overrides: Partial<Quest> & Pick<Quest, 'id' | 'title'>,
): Quest {
  const { id, title, ...optionalOverrides } = overrides
  return {
    id,
    emoji: '◆',
    title,
    description: 'Complete the practice.',
    group: 'daily',
    difficulty: 'easy',
    color: '#9fb683',
    required: true,
    minLevel: 1,
    schedule: { kind: 'daily' },
    ...optionalOverrides,
  }
}

function createState(overrides: Partial<HanaGameState> = {}): HanaGameState {
  return {
    schemaVersion: 5,
    startDate: '2026-08-01',
    currentDate: '2026-08-01',
    customHabits: [],
    deletedHabitIds: [],
    historyEpoch: 'test-history',
    syncRevision: 1,
    habitSettings: {},
    openActivities: [],
    openActivityLogs: {},
    dailyEmotions: {},
    trackingPauses: [],
    backfillAudit: [],
    activeDailyQuests: {},
    activeLongTermQuestIds: [],
    dailyCompletions: {},
    habitOccurrences: {},
    longTermWindows: {},
    longTermCompletions: {},
    questSkips: {},
    eveningWeeds: {},
    totalFlowers: 0,
    ...overrides,
  }
}
