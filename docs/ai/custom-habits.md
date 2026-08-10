# Custom Habits (Technical)

Technical source of truth for user-created habits shared by Hana and Cramble.

## Files

- `src/components/AddHabitDialog.tsx` owns the accessible native dialog and
  form state.
- `src/lib/customHabits.ts` owns input validation, id generation, cadence
  formatting, schedule creation, profile copy/colors, and limits.
- `src/lib/openActivities.ts` owns the separate deadline-free definition,
  validation, current/recent-day mutations, normalization, and neutral summary
  helpers. `src/lib/openActivityStats.ts` derives factual range statistics.
- `src/lib/hanaGame.ts` normalizes definitions and occurrence counts, merges the
  effective catalog, plans cards, computes period progress and rewards, supports
  record/undo, and resets progress.
- `src/App.tsx` and `src/features/cramble/CrambleExperience.tsx` create habits
  and commit record/undo mutations inside separate controllers and save queues.
- `src/pages/HanaPage.tsx`, `src/pages/CramblePage.tsx`, `QuestSection`, and
  `QuestCard` derive completed state and progress from the shared schedule helper.
- `src/lib/hanaCloudSync.ts` and `src/lib/hanaStats.ts` derive one reporting row
  per flexible period from the merged catalog.
- `src/lib/customHabits.test.ts` covers validation, same-day repetition,
  all-or-nothing rewards, undo, renewal, normalization, reset, cloud rows, and
  profile isolation.
- `src/lib/habitLifecycle.ts` owns profile/habit pause intervals, archive and
  restore, permanent custom-habit purge, reminder/cue settings, and correction
  limits.
- `src/components/AddAnytimeLogDialog.tsx` and `AnytimeLogSection.tsx` implement
  the shared create/manage flow and Today cards for deadline-free records.
- `src/components/PauseTrackingDialog.tsx`, `BackfillDialog.tsx`, and
  `TodayHabitControls.tsx` expose recovery controls shared by both themes.
- `src/components/ExportDataDialog.tsx` chooses between a themed HTML Chronicle,
  a formula-safe CSV report, and a versioned JSON backup.
- `src/lib/habitExport.ts` creates the profile-isolated CSV and self-describing
  JSON backup; `src/lib/habitChronicle.ts` creates the escaped, self-contained,
  print-friendly HTML report.
- `src/lib/logicalDay.ts` owns the fixed local 04:00 tracking-day boundary and
  resolves after-midnight reminder instants.
- `src/hooks/useHabitReminders.ts` delivers best-effort in-app/browser reminders
  while the PWA is visible; it is not closed-app Web Push.

## Input contract

```ts
type HabitFrequency = 'oncePerPeriod' | 'timesPerPeriod'
type HabitPeriodUnit = 'days' | 'weeks'

type NewHabitInput = {
  title: string
  description: string
  frequency: HabitFrequency
  target: number
  periodLength: number
  periodUnit: HabitPeriodUnit
  difficulty: 'easy' | 'medium' | 'hard'
  cue?: string
  reminderTime?: string | null
}

type NewOpenActivityInput = {
  title: string
  description: string
  kind: 'check' | 'count'
  unit?: string | null
  emoji?: string
  color?: string
}
```

## Lifecycle contract

Persisted snapshots normalize to schema version 4 and include
`openActivities` and `openActivityLogs`; they may also contain `habitSettings`,
`questActivations`, finite criteria/graduation state, `trackingPauses`,
`backfillAudit`, `deletedHabitIds`, `historyEpoch`, and
`syncRevision`. `habitSettings` is keyed by any built-in, custom quest, or
anytime id so pause and archive behavior stays shared. Permanent deletion
removes the definition and raw history and retains a tombstone for conflict
resurrection protection.

Pause intervals use inclusive `startDate` / `endDate`; `endDate: null` means
manual resume. `isHabitTrackableOnDate()` is the shared guard for planning,
recording, backfill, and reminders. Paused, archived, graduated, and skipped
windows are neutral in
analytics and excluded from success/momentum denominators.

Every scheduled custom quest is a finite chapter. The forgiving path completes
through either a difficulty-scaled combo or a steady total; the total-only path
never resets. A multi-record period contributes one success only when its whole
target is met. New custom quests begin on the next 04:00 tracker day.

Rule edits are allowed only before a custom habit has a completion, occurrence,
skip, or earlier presented day. After that boundary, cadence and difficulty are
locked because the current reward engine recomputes history from the saved
definition. Content, cue, and reminder edits remain safe. Built-in wording can
change through `habitSettings`, but its scoring rule stays immutable. Archive
plus a new habit is the supported path for a later scoring-rule change.

Backfill accepts only the previous three logical tracking dates and rejects future,
pre-start, pre-creation, paused, archived, unscheduled, locked, or passed dates.
`backfillAudit` retains performed date, recorded timestamp, and delta; the same
window supports an audited one-record undo. Statistics keep those three dates
open until the correction window closes.

`todayKey()` delegates to `getLogicalDayKey()`: 00:00 through 03:59 maps to the
previous local date, while 04:00 begins the next tracking day. Reminder times
before 04:00 are resolved onto the following calendar date within that same
logical day. The reminder hook also verifies that `game.currentDate` equals the
current logical key before delivery, preventing a stale-day send during rollover.
Legacy completion rows have no event time, so they are never bulk-shifted.

## Deadline-free anytime logs

Anytime records are deliberately not a `QuestSchedule` branch. Treating them as
fake daily habits would create due cards, missed periods, rewards, skips,
reminders, and misleading success rates. They live beside the quest engine:

```ts
type OpenActivity = {
  id: string
  custom: true
  title: string
  description: string
  emoji: string
  color: string
  kind: 'check' | 'count'
  unit: string | null
  createdDate: string
}

openActivities: OpenActivity[]
openActivityLogs: Record<dateKey, Record<activityId, number>>
```

A `check` value normalizes to `1`; a `count` value is a positive safe integer
up to 999,999. Zero is represented by the absence of a value. Mutations use the
profile's logical `currentDate`, so an action before 04:00 belongs to the prior
calendar date. Recent-day changes use the same three-day limit and reject
future, pre-start, pre-creation, paused, and archived dates.

Anytime records never participate in quest planning, Today denominators,
flowers/renown, pass/skip budgets, reminders, period outcomes, success rates, or
momentum signals. Their Ledger path instead reports active days, total values,
average per active day, weekly pace, peak, and latest recorded date. Blank days
remain neutral. Positive dated values count as tracked dates in Shared Journey,
but they are excluded from its settled rhythm, trend, and strongest-goal math.

Definition type and unit can change until the first positive record. After
history exists, controllers reject either change so past quantities keep the
same meaning. Wording remains editable. Profile/habit pause, archive/restore,
and permanent deletion reuse `habitLifecycle`; deleting purges every dated
value. Reset preserves definitions and lifecycle settings but clears logs.

The form exposes two goal patterns:

- **Once per period** always writes `target: 1`.
- **Several times** accepts an integer target from 2 through 100.

The form presents three schedule choices for either goal pattern:

- **Daily** maps to one day;
- **Weekly** maps to a Sunday-to-Saturday calendar week; and
- **Custom** reveals an integer rolling period from 1 through 365 days.

The control state is presentation-only. `resolveHabitPeriodPreset()` derives the
existing `periodLength` / `periodUnit` input at submission, so saved habits need
no migration. Custom 7 days intentionally remains a creation-anchored rolling
window and is distinct from Weekly. Names are trimmed and limited to 60
characters. Descriptions are required, trimmed, and limited to 180 characters.
A case-insensitive title collision with any built-in or custom habit in the same
profile is rejected.

Difficulty maps through the shared reward table: easy = 1, medium = 2, hard =
3. This value is the reward for completing the entire period goal, not for each
recorded repetition. The persisted field remains `totalFlowers`; Cramble
presents the same value as renown.

## Canonical schedule mapping

Every habit created by the current form uses `periodTarget`:

```ts
type PeriodTargetSchedule = {
  kind: 'periodTarget'
  target: number
  periodDays: number
  anchor: 'calendarWeek' | 'questStart'
}
```

The UI maps to it as follows:

```text
once per 1 day       -> target 1, periodDays 1, questStart
2 times per 1 day    -> target 2, periodDays 1, questStart
once per 3 days      -> target 1, periodDays 3, questStart
3 times per 10 days  -> target 3, periodDays 10, questStart
once/several per week -> target 1/x, periodDays 7, calendarWeek
once per custom 14 days -> target 1, periodDays 14, questStart
```

The Weekly preset uses a Sunday-to-Saturday calendar window. Daily and Custom
use consecutive windows anchored to `CustomHabitQuest.createdDate`. This gives
a newly created rolling habit a complete first window.

Unlike legacy quotas, `periodTarget.target` may exceed `periodDays`; that is what
makes two or more records in one day possible. Schedule validation caps the
canonical values at 100 occurrences and 365 days. The Custom control uses that
same 365-day engine maximum.

## Persisted model and catalog merge

`GameState.customHabits` is a `CustomHabitQuest[]`. Every definition includes:

- an opaque `custom-<profile>-...` id without `:`;
- the display fields and difficulty;
- `custom: true`, `createdDate`, `group: 'daily'`, `required: true`, and
  `minLevel: 1`; and
- a validated schedule.

`GameState.habitOccurrences` stores dated counts for the new model:

```ts
habitOccurrences: Record<dateKey, Record<questId, number>>
```

It is intentionally separate from legacy
`dailyCompletions[dateKey][questId]: boolean`. Multiple records for the same
habit on the same date increment the integer count. A record is ignored once
the current period target is complete. `undoQuestCompletion()` subtracts one
record from the current date when one exists; the UI labels this **Undo one**.

`getQuestCatalog(baseQuests, state)` is the central merge boundary. Built-in
quests are ordered first and win id collisions; normalized custom definitions
are appended. New custom scheduled habits receive an activation date for the
next tracker day. There is no rotating quest limit.

`parseStoredHanaState()` treats absent `customHabits`, `habitOccurrences`,
`openActivities`, and `openActivityLogs` fields as empty for old snapshots. It
rejects malformed definitions, invalid colors/dates, unsafe ids, unsupported
schedules, duplicate ids or titles, and collisions with the current built-in
catalog. Scheduled occurrence buckets require a real local date and positive
safe-integer counts no greater than 100; anytime values are normalized against
their own definition and cap. Rejected or unknown definitions cannot earn
rewards or produce analytics rows.

## Period progress and rewards

`getQuestScheduleProgress()` is the sole source for period start/end, total
records, records today, remaining count, completion state, label, and card
eligibility. Progress labels include `1 of 2 today`, `2 of 3 this week`, and
`1 of 3 in 10 days`.

A `periodTarget` is complete only when the sum of dated occurrence counts inside
its inclusive window reaches `target`. Before that moment it earns no flowers or
renown. Reaching the target awards the difficulty value exactly once for the
whole period. Undoing one record can take the period below target and removes
that reward during recomputation. There is no penalty or partial-reward debt.

After completion, later dates omit the card until the next period. It remains
visible on a completion date that has records, allowing **Undo one** to correct
an accidental tap. The next window begins with zero progress while completed
older windows keep their one earned reward.

Period targets cannot consume Hana skips or Cramble passes. Their flexible
window is reported as one outcome, so unused days inside a successful period do
not become individual misses.

## Legacy compatibility

Existing stored custom habits may still use `daily` or `quota`. Those definitions
and their boolean `dailyCompletions` remain valid so an upgrade does not rewrite
history or remove already earned rewards. Legacy quota rewards continue to
accrue per dated completion, capped at the quota target. The current Add habit UI
does not create new legacy quotas.

Never silently convert legacy booleans to `habitOccurrences` or reinterpret
legacy quota rewards as all-or-nothing. Both models are explicit schedule kinds
and reward/cloud derivation branches accordingly.

## Persistence, reporting, and isolation

No SQL migration is required. Scheduled definitions/counts and anytime
definitions/logs live in the existing JSONB profile snapshot. Anytime records
are intentionally absent from `hana_quest_statuses`, whose rows represent
scored goal windows. Derived scheduled quest-status rows use the existing period
columns:

- `periodKey` and `windowStart` are the inclusive period start;
- `dueDate` is the inclusive period end;
- `dateKey` is `null`;
- partial `periodTarget` progress is `pending` with `flowersEarned: 0`; and
- a completed target is `completed` with one difficulty reward.

Stats consume those same rows, producing one open/completed/missed result per
period rather than daily misses. The full per-date counts remain in the JSONB
snapshot.

Both controllers cache and queue the complete state, so an offline habit or
occurrence is retried with its definition. Isolation comes from the owning
controller/state plus profile-specific cache, pending key, database profile id,
base catalog, and save queue. Generic merge, sync, and stats helpers must always
receive the correct base catalog and profile.

Postgres stores one canonical `state jsonb` snapshot row per profile, not one
global JSON document. SQL quest/weed status tables are derived projections. The
versioned JSON export uses a `hanafy-profile-backup` envelope containing profile
identity, export time, 04:00/time-zone metadata, source schema/database revision,
the resolved effective catalog, and the profile state. `syncRevision` is copied
only to source metadata and omitted from the portable state so a later importer
cannot replay an old optimistic-lock revision. Deleted built-in tombstones remain
in the backup so they do not silently reappear after a future restore. The
current app creates backups but does not import them yet.

The API rejects unsupported state schemas and any write whose state schema is
older than the stored snapshot. This prevents an old cached PWA bundle from
reading a version-3 snapshot, normalizing it through an older model, and
overwriting the anytime fields. Such a write returns the normal conflict
response and leaves the newer database snapshot intact.

The CSV includes separate `anytime_activity` and `anytime_log` rows. Backup
format version 2 carries the complete version-3 state and a resolved anytime
catalog; older format-version-1 files predate this catalog branch. The HTML
Chronicle includes aggregate and per-habit schedule-aware history plus a neutral
Anytime records section for active, paused, and archived items. It omits private
pause reasons and notes, escapes all user-authored content, contains no remote
assets or scripts, and can be printed to PDF. Open, skipped, paused, and blank
anytime days remain visibly neutral rather than being counted as failures.

`resetProfileProgress()` clears `habitOccurrences`, `openActivityLogs`, boolean
completions, skips, weeds, and rewards while preserving `startDate`,
`currentDate`, and copied scheduled/anytime definitions.

## UI and accessibility

The Add habit action is the first item in each sticky bottom dock. Hana disables
it in Explore mode. It first opens a Scheduled habit / Anytime log chooser.
Both forms use native `<dialog>` behavior for focus containment and Escape,
restore focus on close, support backdrop dismissal, announce field-specific
validation errors, keep controls at least 44px tall, and use profile-scoped
Garden/Archive styling.

The form uses native-radio Daily / Weekly / Custom schedule choices, reveals the
day count only for Custom, displays a live cadence sentence, and states the
all-or-nothing reward before submission. A period card uses **Record +1**, a numeric progress label and
bar, **+N at goal**, and **Undo one** when the current date has records. The
completed card disables further recording. These controls and reduced-motion
behavior remain shared between Hana and Cramble.
