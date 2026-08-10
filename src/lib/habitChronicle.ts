import type { HanaProfileId } from '@/lib/hanaCloudSync'
import {
  getLevel,
  getQuestCatalog,
} from '@/lib/hanaGame'
import {
  formatQuestCadence,
  getHabitRangeStats,
  type HabitPeriodStatus,
  type HabitRangeStats,
} from '@/lib/hanaStats'
import {
  hasHabitHistory,
  isHabitArchivedOnDate,
  isHabitGraduatedOnDate,
  isHabitPausedOnDate,
} from '@/lib/habitLifecycle'
import { LOGICAL_DAY_START_HOUR } from '@/lib/logicalDay'
import type { HanaGameState, OpenActivity, Quest } from '@/types'
import { getOpenActivityCatalog } from '@/lib/openActivities'
import {
  getOpenActivityRangeStats,
  type OpenActivityRangeStats,
} from '@/lib/openActivityStats'
import { getQuestCompletionProgress } from '@/lib/questCompletion'
import { describeQuestCompletionCriteria } from '@/lib/questCompletionRules'

type ChronicleTheme = {
  documentTitle: string
  eyebrow: string
  introduction: string
  mark: string
  page: string
  panel: string
  ink: string
  muted: string
  accent: string
  accentSoft: string
  border: string
}

type ChronicleHabit = {
  quest: Quest
  stats: HabitRangeStats
  lifecycle: 'active' | 'paused' | 'archived' | 'graduated' | 'legacy'
  archivedAt: string | null
  completionLabel: string
  completionProgress: string
}

type ChronicleOpenActivity = {
  activity: OpenActivity
  stats: OpenActivityRangeStats
  lifecycle: 'active' | 'paused' | 'archived'
  archivedAt: string | null
}

const THEMES: Record<HanaProfileId, ChronicleTheme> = {
  hana: {
    documentTitle: 'The Garden Record',
    eyebrow: "Hana's gentle chronicle of becoming",
    introduction:
      'Every mark is information. Blooms celebrate what was tended; quiet spaces leave room to begin again.',
    mark: '✿',
    page: '#f7f1e8',
    panel: '#fffaf3',
    ink: '#342f2d',
    muted: '#786f69',
    accent: '#8a655c',
    accentSoft: '#eadbd3',
    border: '#dfd1c6',
  },
  cramble: {
    documentTitle: 'The Sunward Chronicle',
    eyebrow: "Cramble's record of the road so far",
    introduction:
      'Each fulfilled quest strengthens the traveller. Unfinished pages are not defeat; they are simply places where the story may resume.',
    mark: '◆',
    page: '#17171d',
    panel: '#232229',
    ink: '#f4ead7',
    muted: '#c3b59e',
    accent: '#d0ad68',
    accentSoft: '#3a342a',
    border: '#574a38',
  },
}

/**
 * Builds a portable, self-contained progress chronicle. The report contains
 * final habit outcomes only: private pause reasons and notes are never read or
 * rendered.
 */
export function buildProfileChronicleHtml(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
  exportedAt: Date | string = new Date(),
) {
  const theme = THEMES[profileId]
  const habits = getChronicleHabits(state, baseQuests, profileId)
  const anytimeActivities = getChronicleOpenActivities(state)
  const summary = summarizeHabits(habits, anytimeActivities)
  const exportedDate = normalizeExportDate(exportedAt)
  const historyStart = getHistoryStart(state, habits, anytimeActivities)

  return `<!doctype html>
<html lang="en" data-profile="${profileId}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(theme.documentTitle)}</title>
  <style>
    :root {
      color-scheme: ${profileId === 'cramble' ? 'dark' : 'light'};
      --page: ${theme.page};
      --panel: ${theme.panel};
      --ink: ${theme.ink};
      --muted: ${theme.muted};
      --accent: ${theme.accent};
      --accent-soft: ${theme.accentSoft};
      --border: ${theme.border};
      --met: #759562;
      --missed: #a4655f;
      --neutral: #748a99;
      --open: #aa9368;
    }
    * { box-sizing: border-box; }
    html { background: var(--page); }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 32rem),
        var(--page);
      color: var(--ink);
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    main { width: min(1060px, calc(100% - 32px)); margin: 0 auto; padding: 54px 0 72px; }
    .cover {
      position: relative;
      overflow: hidden;
      padding: 44px;
      border: 1px solid var(--border);
      border-radius: 28px;
      background: color-mix(in srgb, var(--panel) 94%, transparent);
      box-shadow: 0 24px 70px color-mix(in srgb, #000 16%, transparent);
    }
    .cover::after {
      content: '${theme.mark}';
      position: absolute;
      right: 32px;
      top: 15px;
      color: var(--accent);
      font-size: 7rem;
      line-height: 1;
      opacity: .12;
    }
    .eyebrow, .section-kicker {
      margin: 0 0 10px;
      color: var(--accent);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: .76rem;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { max-width: 760px; margin-bottom: 14px; font-size: clamp(2.35rem, 6vw, 4.5rem); line-height: .98; }
    h2 { margin-bottom: 7px; font-size: 1.75rem; }
    h3 { margin: 0; font-size: 1.28rem; line-height: 1.2; }
    .introduction { max-width: 700px; margin-bottom: 30px; color: var(--muted); font-size: 1.08rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .meta li, .lifecycle {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 7px 11px;
      background: var(--accent-soft);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: .78rem;
      font-weight: 700;
    }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 18px 0 46px; }
    .summary-card { padding: 18px; border: 1px solid var(--border); border-radius: 18px; background: var(--panel); }
    .summary-card strong { display: block; font-size: 1.65rem; line-height: 1; }
    .summary-card span { display: block; margin-top: 8px; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: .75rem; }
    .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 18px; }
    .section-heading p { margin: 0; color: var(--muted); font-size: .9rem; }
    .habit-list { display: grid; gap: 18px; }
    .habit {
      --habit: var(--accent);
      overflow: hidden;
      border: 1px solid var(--border);
      border-left: 5px solid var(--habit);
      border-radius: 22px;
      background: var(--panel);
      break-inside: avoid-page;
    }
    .habit-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 24px 24px 18px; }
    .habit-title { display: flex; gap: 13px; align-items: flex-start; }
    .emoji { display: grid; width: 45px; height: 45px; flex: 0 0 45px; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--accent-soft); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 1.35rem; }
    .description { max-width: 700px; margin: 5px 0 0; color: var(--muted); }
    .lifecycle { flex: 0 0 auto; padding: 5px 10px; text-transform: capitalize; }
    .habit.archived { opacity: .9; }
    .habit-stats { display: grid; grid-template-columns: repeat(6, 1fr); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .habit-stat { padding: 15px 18px; border-right: 1px solid var(--border); }
    .habit-stat:last-child { border-right: 0; }
    .habit-stat strong { display: block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 1.02rem; }
    .habit-stat span { color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: .69rem; text-transform: uppercase; letter-spacing: .06em; }
    .period-history { padding: 19px 24px 24px; }
    .history-label { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 11px; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: .75rem; }
    .periods { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .period {
      min-width: 92px;
      padding: 9px 10px;
      border: 1px solid var(--border);
      border-top: 4px solid var(--period-color);
      border-radius: 10px;
      background: color-mix(in srgb, var(--period-color) 8%, var(--panel));
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .period.completed { --period-color: var(--met); }
    .period.recorded { --period-color: var(--accent); }
    .period.missed { --period-color: var(--missed); }
    .period.skipped, .period.paused { --period-color: var(--neutral); }
    .period.open { --period-color: var(--open); }
    .period time, .period span { display: block; }
    .period time { color: var(--muted); font-size: .66rem; }
    .period strong { display: block; margin: 2px 0 1px; font-size: .86rem; }
    .period span { color: var(--muted); font-size: .68rem; }
    .empty-history { margin: 0; padding: 13px; border: 1px dashed var(--border); border-radius: 12px; color: var(--muted); }
    .legend { display: flex; flex-wrap: wrap; gap: 13px; margin: 13px 0 0; padding: 0; list-style: none; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: .72rem; }
    .legend i { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; background: var(--legend); }
    .privacy-note { margin-top: 24px; padding: 17px 20px; border: 1px solid var(--border); border-radius: 16px; color: var(--muted); background: var(--accent-soft); font-size: .85rem; }
    footer { margin-top: 38px; color: var(--muted); text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; font-size: .75rem; }
    @media (max-width: 780px) {
      main { width: min(100% - 20px, 1060px); padding-top: 20px; }
      .cover { padding: 28px 22px; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .habit-head { padding: 20px 18px 15px; }
      .habit-stats { grid-template-columns: repeat(3, 1fr); }
      .habit-stat:nth-child(3) { border-right: 0; }
      .habit-stat:nth-child(-n + 3) { border-bottom: 1px solid var(--border); }
      .period-history { padding: 17px 18px 20px; }
    }
    @media print {
      @page { size: A4; margin: 13mm; }
      :root { color-scheme: light; --page: #fff; --panel: #fff; --ink: #24211f; --muted: #615b56; --border: #d9d3cc; --accent-soft: #f4f0eb; }
      body { background: #fff; font-size: 11pt; }
      main { width: 100%; padding: 0; }
      .cover { padding: 25px; border-radius: 16px; box-shadow: none; break-after: avoid-page; }
      h1 { font-size: 34pt; }
      .summary { margin-bottom: 26px; }
      .summary-card { padding: 12px; }
      .habit { border-radius: 12px; }
      .habit-list { gap: 12px; }
      .period { min-width: 80px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="cover">
      <p class="eyebrow">${escapeHtml(theme.eyebrow)}</p>
      <h1>${escapeHtml(theme.documentTitle)}</h1>
      <p class="introduction">${escapeHtml(theme.introduction)}</p>
      <ul class="meta">
        <li>${escapeHtml(formatDateRange(historyStart, state.currentDate))}</li>
        <li>Tracking day: ${formatTrackingHour()}–3:59 AM next day</li>
        <li>Level ${getLevel(state.totalFlowers)}</li>
        <li>${summary.active} active · ${summary.paused} paused · ${summary.graduated} bloomed · ${summary.legacy} earlier · ${summary.archived} archived</li>
        <li>Exported ${escapeHtml(formatExportedAt(exportedDate))}</li>
      </ul>
    </header>

    <section class="summary" aria-label="All-time summary">
      ${summaryCard(formatNumber(summary.records), 'Recorded actions')}
      ${summaryCard(summary.decided ? `${summary.successRate}%` : '—', 'Resolved-window success')}
      ${summaryCard(formatNumber(summary.completed), 'Goal windows met')}
      ${summaryCard(formatNumber(summary.neutral), 'Neutral windows')}
      ${summaryCard(formatNumber(state.totalFlowers), profileId === 'hana' ? 'Flowers earned' : 'Renown earned')}
    </section>

    <section aria-labelledby="habit-history-heading">
      <div class="section-heading">
        <div>
          <p class="section-kicker">${theme.mark} ${habits.length} ${habits.length === 1 ? 'habit' : 'habits'}</p>
          <h2 id="habit-history-heading">Habit history</h2>
        </div>
        <p>Newest goal windows appear first.</p>
      </div>
      <div class="habit-list">
        ${habits.length ? habits.map(renderHabit).join('\n') : renderEmptyChronicle()}
      </div>
      <ul class="legend" aria-label="Goal-window legend">
        <li><i style="--legend:var(--met)"></i>Met</li>
        <li><i style="--legend:var(--missed)"></i>Missed</li>
        <li><i style="--legend:var(--neutral)"></i>Passed or paused (neutral)</li>
        <li><i style="--legend:var(--open)"></i>Still open</li>
      </ul>
    </section>

    ${renderOpenActivitySection(anytimeActivities, theme)}

    <aside class="privacy-note">
      Neutral windows do not lower success rates. Blank days in anytime records are neutral and intentionally omitted. Personal pause reasons and notes are intentionally excluded from this chronicle.
    </aside>
    <footer>Created from the local ${escapeHtml(profileId === 'hana' ? 'Hana' : 'Cramble')} profile · Dates follow the 4:00 AM tracking day.</footer>
  </main>
</body>
</html>`
}

export function downloadProfileChronicle(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  const html = buildProfileChronicleHtml(state, baseQuests, profileId)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${profileId}-habit-chronicle-${state.currentDate}.html`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getChronicleHabits(
  state: HanaGameState,
  baseQuests: Quest[],
  profileId: HanaProfileId,
) {
  const level = getLevel(state.totalFlowers)
  return getQuestCatalog(baseQuests, state).reduce<ChronicleHabit[]>(
    (result, quest) => {
      const stats = getHabitRangeStats(
        state,
        baseQuests,
        profileId,
        quest.id,
        'all',
      )
      if (!stats) return result

      const archived = isHabitArchivedOnDate(state, quest.id)
      const graduated = !archived && isHabitGraduatedOnDate(state, quest.id)
      const legacy = !archived && !graduated && quest.catalogState === 'legacy'
      const paused =
        !archived &&
        !graduated &&
        !legacy &&
        isHabitPausedOnDate(state, quest.id)
      const attempted =
        hasHabitHistory(state, quest.id) ||
        stats.periods.length > 0 ||
        stats.totalRecords > 0
      const isNeverUnlockedFuture =
        ((quest.minLevel ?? 1) > level ||
          !state.questActivations?.[quest.id]) &&
        !attempted &&
        !archived &&
        !paused &&
        !graduated
      if (isNeverUnlockedFuture) return result
      const completion = getQuestCompletionProgress(
        state,
        baseQuests,
        profileId,
        quest,
      )

      result.push({
        quest,
        stats,
        lifecycle: archived
          ? 'archived'
          : graduated
            ? 'graduated'
            : legacy
              ? 'legacy'
            : paused
              ? 'paused'
              : 'active',
        archivedAt: state.habitSettings?.[quest.id]?.archivedAt ?? null,
        completionLabel: describeQuestCompletionCriteria(completion.criteria),
        completionProgress: completion.paths
          .map((path) => `${Math.min(path.current, path.target)}/${path.target}`)
          .join(' or '),
      })
      return result
    },
    [],
  ).sort(sortChronicleHabits)
}

function getChronicleOpenActivities(state: HanaGameState) {
  return getOpenActivityCatalog(state)
    .reduce<ChronicleOpenActivity[]>((result, activity) => {
      const stats = getOpenActivityRangeStats(state, activity.id, 'all')
      if (!stats) return result
      const archived = isHabitArchivedOnDate(state, activity.id)
      const paused = !archived && isHabitPausedOnDate(state, activity.id)
      result.push({
        activity,
        stats,
        lifecycle: archived ? 'archived' : paused ? 'paused' : 'active',
        archivedAt: state.habitSettings?.[activity.id]?.archivedAt ?? null,
      })
      return result
    }, [])
    .sort(sortChronicleOpenActivities)
}

function sortChronicleOpenActivities(
  first: ChronicleOpenActivity,
  second: ChronicleOpenActivity,
) {
  const lifecycleOrder = { active: 0, paused: 1, archived: 2 }
  return (
    lifecycleOrder[first.lifecycle] - lifecycleOrder[second.lifecycle] ||
    first.activity.title.localeCompare(second.activity.title)
  )
}

function sortChronicleHabits(first: ChronicleHabit, second: ChronicleHabit) {
  const lifecycleOrder = {
    active: 0,
    paused: 1,
    graduated: 2,
    legacy: 3,
    archived: 4,
  }
  return (
    lifecycleOrder[first.lifecycle] - lifecycleOrder[second.lifecycle] ||
    first.quest.title.localeCompare(second.quest.title)
  )
}

function summarizeHabits(
  habits: ChronicleHabit[],
  anytimeActivities: ChronicleOpenActivity[],
) {
  const totals = habits.reduce(
    (result, { quest, stats }) => ({
      records:
        result.records +
        (quest.group === 'longTerm'
          ? stats.completedPeriods
          : stats.totalRecords),
      completed: result.completed + stats.completedPeriods,
      missed: result.missed + stats.missedPeriods,
      neutral:
        result.neutral + stats.skippedPeriods + stats.pausedPeriods,
    }),
    { records: 0, completed: 0, missed: 0, neutral: 0 },
  )
  const decided = totals.completed + totals.missed
  const anytimeRecords = anytimeActivities.reduce(
    (total, { stats }) => total + stats.activeDays,
    0,
  )
  return {
    ...totals,
    records: totals.records + anytimeRecords,
    decided,
    active:
      habits.filter(({ lifecycle }) => lifecycle === 'active').length +
      anytimeActivities.filter(({ lifecycle }) => lifecycle === 'active').length,
    paused:
      habits.filter(({ lifecycle }) => lifecycle === 'paused').length +
      anytimeActivities.filter(({ lifecycle }) => lifecycle === 'paused').length,
    graduated:
      habits.filter(({ lifecycle }) => lifecycle === 'graduated').length,
    legacy: habits.filter(({ lifecycle }) => lifecycle === 'legacy').length,
    archived:
      habits.filter(({ lifecycle }) => lifecycle === 'archived').length +
      anytimeActivities.filter(({ lifecycle }) => lifecycle === 'archived').length,
    successRate: decided
      ? Math.round((totals.completed / decided) * 100)
      : 0,
  }
}

function renderOpenActivitySection(
  activities: ChronicleOpenActivity[],
  theme: ChronicleTheme,
) {
  if (!activities.length) return ''
  return `<section aria-labelledby="anytime-history-heading" style="margin-top:46px">
      <div class="section-heading">
        <div>
          <p class="section-kicker">${theme.mark} ${activities.length} anytime ${activities.length === 1 ? 'record' : 'records'}</p>
          <h2 id="anytime-history-heading">Anytime records</h2>
        </div>
        <p>Only recorded days appear. Blank days stay neutral.</p>
      </div>
      <div class="habit-list">
        ${activities.map(renderOpenActivity).join('\n')}
      </div>
    </section>`
}

function renderOpenActivity({
  activity,
  stats,
  lifecycle,
  archivedAt,
}: ChronicleOpenActivity) {
  const archivedLabel =
    lifecycle === 'archived' && archivedAt
      ? ` · since ${formatDateKey(archivedAt)}`
      : ''
  const total = activity.kind === 'check'
    ? stats.activeDays
    : activity.kind === 'rating'
      ? stats.averagePerActiveDay
      : stats.total
  const totalLabel = activity.kind === 'check'
    ? 'Logged days'
    : activity.kind === 'rating'
      ? 'Average / 5'
      : activity.unit || 'Total'
  const average = activity.kind === 'check'
    ? `${formatNumber(stats.weeklyPace)}/wk`
    : activity.kind === 'rating'
      ? `${formatNumber(stats.activeDays)} rated days`
      : `${formatNumber(stats.averagePerActiveDay)}${activity.unit ? ` ${activity.unit}` : ''}`
  return `<article class="habit anytime ${lifecycle}" style="--habit:${safeColor(activity.color)}">
    <header class="habit-head">
      <div class="habit-title">
        <span class="emoji" aria-hidden="true">${escapeHtml(activity.emoji)}</span>
        <div>
          <h3>${escapeHtml(activity.title)}</h3>
          <p class="description">${escapeHtml(activity.description)}</p>
        </div>
      </div>
      <span class="lifecycle">${escapeHtml(lifecycle + archivedLabel)}</span>
    </header>
    <div class="habit-stats">
      ${habitStat(activity.kind === 'check' ? 'Once today' : activity.kind === 'rating' ? 'Rating 1-5' : 'Count', 'Record type')}
      ${habitStat(formatNumber(total), totalLabel)}
      ${habitStat(formatNumber(stats.activeDays), 'Active days')}
      ${habitStat(average, activity.kind === 'check' ? 'Pace' : activity.kind === 'rating' ? 'History' : 'Avg / active day')}
      ${habitStat(stats.lastLoggedDate ? formatDateKey(stats.lastLoggedDate) : '—', 'Last recorded')}
      ${habitStat('None', 'Rewards')}
    </div>
    <div class="period-history">
      <div class="history-label"><strong>Recorded days</strong><span>Blank days are neutral and omitted</span></div>
      ${renderOpenActivityDays(stats)}
    </div>
  </article>`
}

function renderOpenActivityDays(stats: OpenActivityRangeStats) {
  const recordedDays = stats.days.filter(({ active }) => active)
  if (!recordedDays.length) {
    return '<p class="empty-history">Nothing has been recorded yet. There are no missed entries.</p>'
  }
  return `<ol class="periods">${[...recordedDays]
    .reverse()
    .map(
      (day) => `<li class="period recorded">
        <time datetime="${escapeHtml(day.dateKey)}">${escapeHtml(formatDateKey(day.dateKey))}</time>
        <strong>Recorded</strong>
        <span>${stats.activity.kind === 'check'
          ? 'Yes'
          : stats.activity.kind === 'rating'
            ? `${formatNumber(day.count)} / 5`
          : `${formatNumber(day.count)}${stats.activity.unit ? ` ${escapeHtml(stats.activity.unit)}` : ''}`}</span>
      </li>`,
    )
    .join('')}</ol>`
}

function renderHabit({
  quest,
  stats,
  lifecycle,
  archivedAt,
  completionLabel,
  completionProgress,
}: ChronicleHabit) {
  const neutral = stats.skippedPeriods + stats.pausedPeriods
  const records =
    quest.group === 'longTerm' ? stats.completedPeriods : stats.totalRecords
  const archivedLabel =
    lifecycle === 'archived' && archivedAt
      ? ` · since ${formatDateKey(archivedAt)}`
      : ''
  return `<article class="habit ${lifecycle}" style="--habit:${safeColor(quest.color)}">
    <header class="habit-head">
      <div class="habit-title">
        <span class="emoji" aria-hidden="true">${escapeHtml(quest.emoji)}</span>
        <div>
          <h3>${escapeHtml(quest.title)}</h3>
          <p class="description">${escapeHtml(quest.description)}</p>
        </div>
      </div>
      <span class="lifecycle">${escapeHtml(lifecycle + archivedLabel)}</span>
    </header>
    <div class="habit-stats">
      ${habitStat(formatQuestCadence(quest), 'Cadence')}
      ${habitStat(capitalize(quest.difficulty), 'Difficulty')}
      ${habitStat(formatNumber(records), 'Records')}
      ${habitStat(stats.decidedPeriods ? `${stats.successRate}%` : '—', 'Success')}
      ${habitStat(formatNumber(neutral), 'Neutral')}
      ${habitStat(completionProgress, 'Quest journey')}
    </div>
    <p class="description" style="padding:0 22px 18px">Finishes after ${escapeHtml(completionLabel)}.</p>
    <div class="period-history">
      <div class="history-label"><strong>Goal-window history</strong><span>${stats.completedPeriods} met · ${stats.missedPeriods} missed · ${neutral} neutral · ${countPeriods(stats, 'open')} open</span></div>
      ${renderPeriods(stats)}
    </div>
  </article>`
}

function renderPeriods(stats: HabitRangeStats) {
  if (!stats.periods.length) {
    return '<p class="empty-history">No goal windows have been recorded yet.</p>'
  }
  return `<ol class="periods">${[...stats.periods]
    .reverse()
    .map(
      (period) => `<li class="period ${period.status}">
        <time datetime="${escapeHtml(period.startDate)}">${escapeHtml(formatPeriodDate(period.startDate, period.endDate))}</time>
        <strong>${escapeHtml(statusLabel(period.status))}</strong>
        <span>${formatNumber(period.completed)} / ${formatNumber(period.target)}</span>
      </li>`,
    )
    .join('')}</ol>`
}

function renderEmptyChronicle() {
  return '<p class="empty-history">No habits have begun yet. Future quests stay private until their chapter opens.</p>'
}

function summaryCard(value: string, label: string) {
  return `<div class="summary-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`
}

function habitStat(value: string, label: string) {
  return `<div class="habit-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`
}

function countPeriods(stats: HabitRangeStats, status: HabitPeriodStatus) {
  return stats.periods.filter((period) => period.status === status).length
}

function getHistoryStart(
  state: HanaGameState,
  habits: ChronicleHabit[],
  anytimeActivities: ChronicleOpenActivity[],
) {
  const starts = habits
    .flatMap(({ stats }) => stats.periods.map((period) => period.startDate))
    .concat(anytimeActivities.map(({ stats }) => stats.rangeStart))
    .sort()
  return starts[0] ?? state.startDate ?? state.currentDate
}

function formatPeriodDate(startDate: string, endDate: string) {
  return startDate === endDate
    ? formatDateKey(startDate)
    : `${formatDateKey(startDate)} – ${formatDateKey(endDate)}`
}

function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate
    ? formatDateKey(startDate)
    : `${formatDateKey(startDate)} – ${formatDateKey(endDate)}`
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  if (Number.isNaN(date.getTime())) return dateKey
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatTrackingHour() {
  const hour = LOGICAL_DAY_START_HOUR % 24
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const clockHour = hour % 12 || 12
  return `${clockHour}:00 ${suffix}`
}

function normalizeExportDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

function formatExportedAt(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(status: HabitPeriodStatus) {
  if (status === 'completed') return 'Met'
  if (status === 'missed') return 'Missed'
  if (status === 'skipped') return 'Passed'
  if (status === 'paused') return 'Paused'
  return 'Open'
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function safeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#8a7865'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;'
    if (character === '<') return '&lt;'
    if (character === '>') return '&gt;'
    if (character === '"') return '&quot;'
    return '&#39;'
  })
}
