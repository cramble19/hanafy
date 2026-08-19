import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ANYTIME_LOG_HOLD_DELAY_MS,
  AnytimeLogSection,
  filterAnytimeActivities,
  isAnytimeLogManageKey,
} from './AnytimeLogSection'
import { DailyEmotionPicker } from './DailyEmotionPicker'
import { QuestCard } from './QuestCard'
import type { OpenActivity, Quest } from '@/types'

const callbacks = {
  onIncrement: () => undefined,
  onDecrement: () => undefined,
  onSetRating: () => undefined,
}

const activities: OpenActivity[] = [
  {
    id: 'check',
    custom: true,
    title: 'Saw a friend',
    description: 'A warm moment',
    emoji: '🫶',
    color: '#d98ba0',
    kind: 'check',
    unit: null,
    createdDate: '2026-08-19',
  },
  {
    id: 'count',
    custom: true,
    title: 'Glasses of water',
    description: 'A small refill',
    emoji: '💧',
    color: '#78ab63',
    kind: 'count',
    unit: 'glasses',
    createdDate: '2026-08-19',
  },
  {
    id: 'rating',
    custom: true,
    title: 'Energy',
    description: 'Notice the day',
    emoji: '✨',
    color: '#d6a653',
    kind: 'rating',
    unit: null,
    createdDate: '2026-08-19',
  },
]

const quest: Quest = {
  id: 'morning-water',
  emoji: '🌱',
  title: 'Morning water',
  description: 'Start with one glass.',
  group: 'daily',
  difficulty: 'easy',
  color: '#78ab63',
  schedule: { kind: 'daily' },
}

describe('simplified daily emotion picker', () => {
  it('shows five icon-only choices with an accessible group and pressed state', () => {
    const html = renderToStaticMarkup(
      <DailyEmotionPicker
        profile="hana"
        value="good"
        onChange={() => undefined}
      />,
    )

    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Today&#x27;s emotion"')
    expect(html.match(/class="daily-emotion-option"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="Good, selected"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).not.toContain('How was today?')
    expect(html).not.toContain('Empty days stay neutral.')
    expect(html).not.toMatch(/>Heavy<|>Low<|>Okay<|>Good<|>Bright</)
  })

  it('disables every emotion choice when tracking is paused', () => {
    const html = renderToStaticMarkup(
      <DailyEmotionPicker
        profile="cramble"
        value={null}
        disabled
        onChange={() => undefined}
      />,
    )

    expect(html.match(/disabled=""/g)).toHaveLength(5)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(5)
  })
})

describe('settled activity states', () => {
  it('filters logs from today counts without changing their saved order', () => {
    expect(
      filterAnytimeActivities(
        activities,
        { check: 1, count: 0, rating: 4 },
        'logged',
      ).map((activity) => activity.id),
    ).toEqual(['check', 'rating'])
    expect(
      filterAnytimeActivities(
        activities,
        { check: 1, count: 0, rating: 4 },
        'unlogged',
      ).map((activity) => activity.id),
    ).toEqual(['count'])
    expect(
      filterAnytimeActivities(
        activities,
        { check: 1, count: 0, rating: 4 },
        'all',
      ),
    ).toBe(activities)
  })

  it('renders an accessible quick-log filter, rating lane, and dense activity board', () => {
    const html = renderToStaticMarkup(
      <AnytimeLogSection
        profile="hana"
        activities={activities}
        todayCounts={{ check: 1, count: 0, rating: 4 }}
        onManage={() => undefined}
        {...callbacks}
      />,
    )

    expect(html).toContain('class="anytime-log-filter"')
    expect(html).toContain('aria-label="Filter anytime logs"')
    expect(html.match(/class="anytime-log-filter-option"/g)).toHaveLength(3)
    expect(html).toContain('data-active="true" aria-pressed="true"')
    expect(html).toContain('class="anytime-log-rating-list"')
    expect(html).toContain('class="anytime-log-board"')
    expect(html.indexOf('anytime-log-rating-list')).toBeLessThan(
      html.indexOf('anytime-log-board'),
    )
    expect(html.match(/anytime-log-card-rating/g)).toHaveLength(1)
    expect(html.match(/anytime-log-card-board/g)).toHaveLength(2)
    expect(html).toContain('anytime-log-card-toggle')
    expect(html).not.toContain('anytime-log-check-button-compact')
    expect(html).toContain('aria-keyshortcuts="Enter Space Shift+F10 ContextMenu"')
    expect(html).toContain('aria-describedby=')
    expect(html.match(/anytime-log-rating-icon/g)).toHaveLength(5)
    expect(html).toContain('aria-label="Rate Energy 5 out of 5"')
    expect(html).toContain('Showing 3 of 3 anytime logs.')
  })

  it('uses one full-card check action with the approved tap and hold guidance', () => {
    const hanaHtml = renderToStaticMarkup(
      <AnytimeLogSection
        profile="hana"
        activities={[activities[0]]}
        todayCounts={{ check: 0 }}
        onManage={() => undefined}
        {...callbacks}
      />,
    )
    const crambleHtml = renderToStaticMarkup(
      <AnytimeLogSection
        profile="cramble"
        activities={[activities[0]]}
        todayCounts={{ check: 1 }}
        onManage={() => undefined}
        {...callbacks}
      />,
    )

    for (const html of [hanaHtml, crambleHtml]) {
      expect(html).toContain('Tap a log to record · Hold to edit')
      expect(html.match(/class="anytime-log-card-toggle"/g)).toHaveLength(1)
      expect(html).not.toContain('anytime-log-check-button')
      expect(html).not.toContain('aria-label="Manage Saw a friend"')
      expect(html).not.toContain('anytime-log-settings-badge')
      expect(html).toContain('aria-keyshortcuts="Enter Space Shift+F10 ContextMenu"')
    }
    expect(hanaHtml).toContain('aria-label="Log Saw a friend for today"')
    expect(hanaHtml).toContain('aria-pressed="false"')
    expect(crambleHtml).toContain(
      'aria-label="Undo today&#x27;s log for Saw a friend"',
    )
    expect(crambleHtml).toContain('aria-pressed="true"')
    expect(ANYTIME_LOG_HOLD_DELAY_MS).toBe(550)
  })

  it('maps both standard keyboard settings shortcuts without stealing toggle keys', () => {
    expect(isAnytimeLogManageKey('F10', true)).toBe(true)
    expect(isAnytimeLogManageKey('ContextMenu', false)).toBe(true)
    expect(isAnytimeLogManageKey('F10', false)).toBe(false)
    expect(isAnytimeLogManageKey('Enter', false)).toBe(false)
    expect(isAnytimeLogManageKey(' ', false)).toBe(false)
  })

  it('removes the Anytime subtitle and marks every recorded activity kind', () => {
    const html = renderToStaticMarkup(
      <AnytimeLogSection
        profile="cramble"
        activities={activities}
        todayCounts={{ check: 1, count: 2, rating: 4 }}
        onAdd={() => undefined}
        {...callbacks}
      />,
    )
    const unrecordedHtml = renderToStaticMarkup(
      <AnytimeLogSection
        profile="hana"
        activities={activities}
        todayCounts={{ check: 0, count: 0, rating: 0 }}
        {...callbacks}
      />,
    )

    expect(html).not.toContain('No deadline')
    expect(html).not.toContain('record what happened')
    expect(unrecordedHtml).not.toContain('No deadline')
    expect(unrecordedHtml).not.toContain('record only what happened')
    expect(html.match(/data-recorded="true"/g)).toHaveLength(3)
    expect(html.match(/anytime-log-card-recorded/g)).toHaveLength(3)
    expect(html.match(/data-anytime-recorded-status="true"/g)).toHaveLength(1)
    expect(html.match(/aria-live="polite"/g)).toHaveLength(4)
    expect(unrecordedHtml.match(/data-recorded="false"/g)).toHaveLength(3)
    expect(unrecordedHtml).not.toContain('anytime-log-card-recorded')
    expect(html).toContain('Saw a friend recorded today.')
    expect(html).not.toContain('Glasses of water recorded today.')
    expect(html).not.toContain('Energy recorded today.')
    expect(html).toContain('2 glasses today')
    expect(html).toContain('Energy logged: 4 of 5')
    expect(html).toContain('Add a field log')
    expect(html).toContain('aria-label="Subtract one glasses from Glasses of water"')
    expect(html).toContain('aria-label="Rate Energy 5 out of 5"')
  })

  it('keeps a completed quest readable and exposes its undo semantics', () => {
    const html = renderToStaticMarkup(
      <QuestCard
        quest={quest}
        checked
        skipped={false}
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('quest-card-complete')
    expect(html).toContain('quest-card-copy')
    expect(html).toContain('data-completed="true"')
    expect(html).toContain('data-state="completed"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Undo today&#x27;s completion for Morning water')
    expect(html).toContain('Morning water')
    expect(html).not.toContain('<s>')
  })
})
