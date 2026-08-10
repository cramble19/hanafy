# Cramble Game (Technical)

Technical source of truth for Cramble's isolated habit experience.

## Product identity

- Realm: **The Sunward Archive**
- Chapter 1: **The First Oath**
- Reward language: renown and rank
- Reward space: **Lantern Observatory — scenic sunward journey**
- Stats surface: **Ledger**
- Visual direction: original celestial-archive fantasy; never copy protected
  characters, house marks, quotes, terminology, or franchise-specific imagery.
- Chronicle voice: original, concise self-improvement and epic-fantasy lines;
  quietly hopeful about changed roads without naming romance or a breakup.

## Entry and navigation

`src/App.tsx` routes Home directly to `CrambleExperience`. Returning home
unmounts the controller; selecting Cramble again loads the saved profile without
an intermediate gate.

## Files

- `src/features/cramble/CrambleExperience.tsx` — isolated controller, hydration,
  state mutations, save queue, and internal views.
- `src/pages/CrambleStartPage.tsx` — consent-first First Oath start.
- `src/pages/CramblePage.tsx` — cadence-aware tracker.
- `src/pages/ObservatoryPage.tsx` — progress-driven two-traveler journey scene.
- `src/pages/CrambleLedgerPage.tsx` — stable quest index and summary statistics.
- `src/pages/CrambleQuestDetailPage.tsx` — range-based per-quest period and
  occurrence analytics.
- `src/data/crambleTasks.json` / `crambleQuests.ts` — Cramble-only catalog.
- `src/data/crambleChronicles.json` — original rotating lines.
- `src/lib/crambleGame.ts` — cache key and chapter progress.
- `src/lib/customHabits.ts` / `src/components/AddHabitDialog.tsx` — shared
  custom-habit validation, creation, and form UI.
- `src/lib/openActivities.ts` / `src/components/AddAnytimeLogDialog.tsx` /
  `src/components/AnytimeLogSection.tsx` — shared deadline-free records and
  Cramble-skinned create/Today UI.
- `src/components/DailyEmotionPicker.tsx` stores the shared neutral emotion
  record with Cramble's brass-sigil SVG treatment.
- `src/pages/EmotionHistoryPage.tsx` renders the shared ordinal Ledger graph;
  Cramble's route applies archive styling and never treats blank dates as misses.
- `src/lib/hanaGame.ts` — shared cadence, date, plan, and reward calculations.
- `src/lib/hanaCloudSync.ts` / `hanaStats.ts` — period-aware serialization and
  reporting.

Shared behavior uses the generic `GameState`, `QuestCard`, and `QuestSection`.
Cramble must always supply `crambleQuests` explicitly.

## Isolation boundary

| Concern | Cramble value |
|---|---|
| Database profile | `cramble` |
| Local cache | `cramble-game/v1` |
| Pending snapshot | `cramble-game/pending-v1` |
| Quest catalog | `crambleQuests` |
| React controller | `CrambleExperience` |
| Save refs | owned by `CrambleExperience` |

The shared database tables are partitioned by `profile_id`. Payload generation
uses `createProfileCloudSyncPayload('cramble', state, crambleQuests)`. The API
rejects child rows whose profile differs from the top-level profile.

## State and start flow

Cramble uses the shared `GameState`. `totalFlowers` is retained as a compatibility
field but is labeled **renown**. The current Cramble catalog uses dated plans and
completions only; compatibility long-term fields remain empty. `eveningWeeds`
also remains empty because Chapter 1 has no negative mechanic.

Ordinary built-in completions remain booleans in `dailyCompletions`. Counted
custom period goals use `habitOccurrences[date][questId]`, which can store more
than one occurrence on the same day.

Before start, `startDate` is `null`. `Begin the First Oath` creates today's state,
clears only `profileId=cramble`, saves it, and opens the tracker. Production start
requires a connection. Development mode saves only the separate local cache.

## Built-in catalog

The base catalog is fixed and contains no random or long-term entries:

| Id | Title | Cadence and action |
|---|---|---|
| `first-draught` | First Draught | daily; water after waking |
| `training-yard` | Training Yard | daily; one physically intensive activity at a safe level |
| `provisioners-plate` | Provisioner's Plate | daily; proper protein-and-color meal |
| `evening-seal` | Evening Seal | daily; brush teeth before bed |
| `sunward-tablet` | Sunward Tablet | Sunday; planned vitamin D tablet with a meal |

All five are required at Level 1. `hanas-sigil` is not part of this profile.
Easy, medium, and hard completions earn 1, 2, and 3 renown.

After the First Oath begins, the bottom **Add habit** action may append deliberate
Cramble-owned goals done once or several times on a Daily, Weekly, or Custom
1–365 day schedule. These live in
`GameState.customHabits`; they do not change the five-entry built-in JSON catalog
or Hana's state. See [Custom Habits](custom-habits.md).

The same action can create a separate **Anytime log**. Check logs record one mark
per logical day; count logs store a whole-number daily amount and optional unit.
They create no deadline, miss, pass, renown, Today denominator, reminder, or
momentum signal. Their neutral field-note history appears in the shared Ledger,
and every blank day remains unjudged.

## Cadence rules

`Quest.schedule` is optional, so Hana's older daily catalog remains compatible:

```ts
type QuestSchedule =
  | { kind: 'daily' }
  | { kind: 'weekly'; daysOfWeek: Weekday[] }
  | {
      kind: 'periodTarget'
      target: number
      periodDays: number
      anchor: 'calendarWeek' | 'questStart'
    }
  | { kind: 'quota'; target: number; periodDays: 7; anchor: 'calendarWeek' }
  | { kind: 'quota'; target: number; periodDays: number; anchor: 'profileStart' }
  | { kind: 'quota'; target: number; periodDays: number; anchor: 'questStart' }
```

- `daily` is eligible every local tracking day (04:00 through 03:59).
- `weekly` is eligible only on listed local weekdays (`0` is Sunday).
- `periodTarget/calendarWeek` is the current custom one-week model. It counts
  records in a Sunday-to-Saturday window and pays out once at the full target.
- `periodTarget/questStart` is the current rolling custom model. It anchors
  consecutive windows to the habit's `createdDate`; arbitrary day choices and
  multi-week choices converted to days use it.
- `quota/calendarWeek` means `x` completions in Sunday–Saturday.
- `quota/profileStart` means `x` completions in consecutive `periodDays` blocks
  anchored to `GameState.startDate`, including a 10-day block.
- `quota/questStart` means consecutive blocks anchored to the habit's own
  `createdDate`; this branch remains for legacy saved quotas.

Calendar-week targets are not prorated when a habit is added midweek. All other
new custom periods begin on their creation date, so they receive a complete
first rolling window.

`getQuestScheduleProgress()` owns period bounds, completion count, remaining
count, current-day count, label, and today's eligibility. A `periodTarget` tap
records +1 until the goal is complete, and multiple records may share a date.
**Undo one** subtracts one current-day record. A completed goal stays editable on
a date that has records; later dates hide it until the next period. Required
eligible quests are never truncated by the optional rotating-card limit.

Schedules apply only to `group: 'daily'`. Weekly days must be nonempty, unique
integers from 0 through 6. Current `periodTarget` schedules allow targets from 1
through 100 and periods from 1 through 365 days; the target may exceed the day
count for goals such as twice daily. `calendarWeek` always has seven days and
`questStart` requires a valid `createdDate`. Legacy quotas retain
`1 <= target <= periodDays`. Never reuse a quest id when changing cadence because
dated history would be reinterpreted.

Three passes are available per Sunday-based week for ordinary daily and
exact-weekday lessons. A pass earns no renown and does not break progress.
Flexible `quota` and `periodTarget` habits cannot consume passes. A current
period target earns zero renown while partial and exactly one difficulty reward
when all occurrences are recorded. Undoing below the target removes that reward;
partial progress has no penalty.

New counted records live in
`habitOccurrences[date][questId]: number`; old persisted states normalize a
missing occurrence map to `{}`. Ordinary and legacy custom completions remain
booleans in `dailyCompletions`, and legacy quota rewards retain their original
per-occurrence, target-capped behavior. Cloud analytics collapse either flexible
schedule into one period row with `periodKey` and `windowStart` at the period
start and `dueDate` at its end. A partial `periodTarget` row is pending with zero
reward; a completed row has one difficulty reward. Partial days therefore do not
become false misses. Removed or rejected catalog ids are ignored for reward and
row derivation.

## Ledger analytics

The Ledger keeps catalog order instead of ranking habits by performance. Each
quest row shows its cadence, six recent period marks, and a clearly labeled
30-day target rate; activating the native button opens its detail view.

`getHabitRangeStats()` builds 7-, 30-, 90-day, or all-time views from the merged
profile catalog. Required Level 1 schedules are expanded from the profile or
habit start, rather than relying only on dates when the app happened to open.
This makes untouched daily or period opportunities visible. Higher-level and
optional quests only derive history from dates where they were presented, so
the report does not invent pre-unlock misses.

The detail page deliberately separates two questions:

- **Period rhythm** has one horizontally scrollable token per scoring window.
  It shows the exact `completed / target` count and a shape-plus-color status:
  Met, In progress, Unfinished, or Passed.
- **Daily activity** is a Monday-first count grid. It shows the exact number of
  records on each date with increasing moss intensity. Empty days are neutral;
  they never imply a miss for a multi-day goal.

Targets met uses `completed / (completed + missed)`. Open and passed windows do
not reduce that rate. Records and weekly pace count only occurrence dates inside
the selected calendar range, while an intersecting period token uses the whole
window's count. Daily habits default to 30 days; exact-weekday and periods of at
least seven days default to 90 days. Current progress, next due date, an
accessible chart summary, a direct legend, and non-punitive copy remain visible.

The shared `getHabitMomentumSignal()` reads all resolved period outcomes rather
than the displayed 30-day percentage. Open windows and passes are neutral. Two
trailing met windows show `🔥 N combo`; one unfinished window after three met
windows keeps `🔥 Strong rhythm`; only three trailing unfinished windows show
Cramble's `🕯️ Rekindle`. The flame may also appear on today's actionable card,
but Rekindle is limited to the Ledger row and detail header. Signals never sort
or recolor the full card, and reduced-motion mode makes the flame static.

## Chapter progress

`CRAMBLE_CHAPTER` defines Rank 5 and 35 renown as the First Oath targets.
`getCrambleChapterProgress()` reports rank progress, renown progress, remaining
values, and the lower percentage. Completion requires both thresholds.

## Observatory journey progression

`getCrambleJourneyProgress(state)` derives the scene directly from
`state.totalFlowers / CRAMBLE_CHAPTER.targetRenown`, clamped to `0..1`. Raw
renown is used instead of `getCrambleChapterProgress().percent` because the
chapter percentage intentionally waits on rank milestones and plateaus between
28 and 34 renown. Every earned renown point should still move the knight a small,
honest distance. Rank remains visible milestone context and is already derived
from the same reward total, so it is not counted twice.

The traveler at the first fire stays fixed at the origin. The knight begins 12%
of the scene width away and advances monotonically to 60% separation, moving up
the road and scaling from `1` to `0.62` for perspective. Both figures remain
visible at 0% and 100%. Landmark copy changes at documented percentage
thresholds, while the written percentage and progress bar remain authoritative.

The scene position is derived at render time. It adds no interaction, reward,
persisted field, or database migration. Undoing a completion or resetting
progress may move the knight back because the scene truthfully reflects current
saved renown; irreversible travel would require an explicitly designed persisted
high-water mark.

## UI variant

`.cramble-archive-shell` scopes a warm archive-at-dusk canvas, dark readable
cards, and brass, ember, indigo, moss, plum, and blue accents while preserving
the shared mobile width, spacing, radii, focus treatment, and tap targets.

The quote card includes a Lucide sword/flame forge mark with slow, pointer-free
CSS motion. It is `aria-hidden`; reduced-motion mode makes it static and removes
the sparks. The Observatory is one tonal step deeper than the everyday Archive.
Its code-native dusk sky, mountain layers, winding road, first fire, gate, woman,
and sword-bearing knight are original silhouettes. Scene decoration is
noninteractive and excluded from assistive technology; the adjacent journey
percentage, rank, renown, landmark, and progress bar are authoritative.

## Verification invariants

- Cache, pending key, controller, save queue, catalog, and DB profile differ from
  Hana's.
- Password matching remains exact and case-sensitive.
- Built-in catalog ids are exactly the five requested habits; normalized custom
  definitions may be appended only within Cramble's state.
- Thursday omits `sunward-tablet`; Sunday includes it.
- Daily, exact-day, legacy-quota, and current `periodTarget` behavior has
  boundary tests.
- Current period targets cover once/custom-window and repeated/custom-window
  creation, multiple same-day records, undo-one, all-or-nothing reward, renewal,
  reset, and malformed-count normalization.
- Flexible goals serialize and score as one outcome per period without false
  daily misses; legacy quotas retain their target-capped per-occurrence reward.
- Journey separation is clamped and monotonic from 0 through 35 renown, including
  the 28–34 renown range where chapter progress intentionally plateaus.
- Both Observatory figures remain visible at the journey endpoints; reduced
  motion removes interpolation without changing the correct final position.
- Every Cramble payload row carries `profileId: 'cramble'`.
- Existing Hana behavior and tests remain compatible.
