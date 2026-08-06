# Custom Habits (Technical)

Technical source of truth for user-created habits shared by Hana and Cramble.

## Files

- `src/components/AddHabitDialog.tsx` owns the accessible native dialog and
  form state.
- `src/lib/customHabits.ts` owns input validation, id generation, cadence
  formatting, schedule creation, profile copy/colors, and limits.
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
}
```

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
are appended. Required custom habits are not truncated by the optional rotating
quest limit.

`parseStoredHanaState()` treats absent `customHabits` and `habitOccurrences`
fields as empty for old snapshots. It rejects malformed definitions, invalid
colors/dates, unsafe ids, unsupported schedules, duplicate ids or titles, and
collisions with the current built-in catalog. Occurrence buckets require a real
local date and positive safe-integer counts no greater than 100. Rejected or
unknown definitions cannot earn rewards or produce analytics rows.

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

No SQL migration is required. Definitions and occurrence counts live in the
existing JSONB profile snapshot. Derived quest-status rows use the existing
period columns:

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

`resetProfileProgress()` clears `habitOccurrences`, boolean completions, skips,
weeds, and rewards while preserving `startDate`, `currentDate`, and copied custom
definitions.

## UI and accessibility

The Add habit action is the first full-width item in each sticky bottom dock.
Hana disables it in Explore mode. The form uses native `<dialog>` behavior for
focus containment and Escape, restores focus on close, supports backdrop
dismissal, announces field-specific validation errors, keeps controls at least
44px tall, and uses profile-scoped Garden/Archive styling.

The form uses native-radio Daily / Weekly / Custom schedule choices, reveals the
day count only for Custom, displays a live cadence sentence, and states the
all-or-nothing reward before submission. A period card uses **Record +1**, a numeric progress label and
bar, **+N at goal**, and **Undo one** when the current date has records. The
completed card disables further recording. These controls and reduced-motion
behavior remain shared between Hana and Cramble.
