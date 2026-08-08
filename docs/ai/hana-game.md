# Hana Game Logic (Technical)

Technical source of truth for Hana's flower-based game loop.

Hana is isolated from Cramble by the `hana` database profile, `hana-game/v1`
cache, `quests` catalog, and the controller/save queue in `src/App.tsx`. Shared
helpers may be profile-aware, but Hana calls must continue to use Hana's catalog
and profile explicitly or through the compatibility wrappers.

## Files

- `src/data/hanaTasks.json` — editable task catalog. Add/remove tasks here.
- `src/data/hanaWeeds.json` — editable end-of-day reflection catalog.
- `src/data/springQuotes.json` — editable Spring quote / April-inspired note catalog.
- `src/data/quests.ts` — typed loader for the JSON catalog.
- `src/lib/hanaGame.ts` — pure game/date/rotation/level helpers.
- `src/lib/customHabits.ts` — validates and creates user-defined habits.
- `src/lib/openActivities.ts` — validates and records deadline-free activities.
- `src/lib/openActivityStats.ts` — derives neutral activity history.
- `src/lib/hanaCloudSync.ts` — converts local Hana state into database sync rows.
- `src/lib/hanaStats.ts` — derives user-facing stats from the same normalized rows.
- `src/App.tsx` — owns Hana's current game state and persistence.
- `api/hana-sync.ts` — Vercel API route that stores Hana history in Postgres.
- `src/pages/HanaStartPage.tsx` — start-date gate before Hana's tracker.
- `src/pages/HanaPage.tsx` — renders the game UI, task sections, dev controls.
- `src/pages/GardenPage.tsx` — renders the dedicated night-garden reward page.
- `src/pages/StatsPage.tsx` — supplies Hana's catalog/profile to the shared Ledger.
- `src/pages/CrambleLedgerPage.tsx` — contains the shared period-aware Ledger page plus Cramble's wrapper.
- `src/pages/QuestDetailPage.tsx` — supplies Hana's catalog/profile to the shared record detail.
- `src/pages/CrambleQuestDetailPage.tsx` — contains the shared record-detail analytics plus Cramble's wrapper.
- `src/components/QuestCard.tsx` and `src/components/QuestSection.tsx` — task UI.
- `src/components/AddHabitDialog.tsx` — shared custom-habit form.
- `src/components/AddAnytimeLogDialog.tsx` and
  `src/components/AnytimeLogSection.tsx` — shared deadline-free create/manage
  flow and Today cards.

## Task schema

```ts
type Quest = {
  id: string
  emoji: string
  title: string
  description: string
  group: 'daily' | 'longTerm'
  difficulty: 'easy' | 'medium' | 'hard'
  color: string
  required?: boolean
  minLevel?: number
  durationDays?: number
  schedule?: QuestSchedule
  custom?: boolean
  createdDate?: string
}
```

`required: true` currently matters for daily tasks: required daily tasks always
show. Optional daily tasks rotate by date.

`minLevel` gates when the task can appear. Omitted means level 1.

`durationDays` applies to long-term quests. Omitted means 7 days.

## Flower currency

Flowers replace XP because they match the "flowers and sunlight" theme.

```ts
easy = 1 flower
medium = 2 flowers
hard = 3 flowers
```

Reward values live in `FLOWERS_BY_DIFFICULTY` in `src/lib/hanaGame.ts`.
Ordinary daily, exact-weekday, and long-term completions earn that value when
checked. A new custom `periodTarget` earns it once only after every required
occurrence in the period is recorded; partial progress earns zero.

## Arc 1: Spring season

Arc 1 is the first complete game season. It is intentionally easier than later
arcs so the user gets positive momentum before the app asks for harder
consistency.

The canonical Spring target lives in `SPRING_ARC` in `src/lib/hanaGame.ts`:

```ts
targetLevel = 5
targetFlowers = 35
```

`getSpringArcProgress(state)` derives:

- `percent`
- `flowerPercent`
- `levelPercent`
- `flowersRemaining`
- `levelsRemaining`
- `isComplete`

Arc 1 is complete only when both the level and net flower targets are reached.
The Garden page treats this as 100% Spring fullness and shows a full-bloom state.

The next season is currently only teased as **Summer: Consistency & tough
choices**. Do not auto-migrate or change task difficulty after Spring completes
until Arc 2 is explicitly designed.

The Spring arc includes subtle *Your Lie in April* mood references:
springtime, music notes, piano/violin/duet language, canelé, blossoms, sunlight.
Do not add copied character art or story content.

The Hana page renders one daily seasonal quote from `src/data/springQuotes.json`.
The quote is picked deterministically from `currentDate`, so it stays stable for
the day. Quote `kind` values are:

- `spring` — public-domain or original spring quotes.
- `april-inspired` — original notes inspired by the spring/music mood.
- `anime-quote` — exact user-provided anime quotes.

## Garden page

The mini emoji garden was removed from `HanaPage`. The quest page shows flower
balance, level progress, a compact illustrated mini garden preview, and a sticky
Garden action bar.

`GardenPage` is the dedicated visual reward space. It renders:

- night sky gradient
- crescent moon
- twinkling CSS stars
- ambient moon drift/glow, drifting sky haze, and occasional CSS comets
- layered hills/ground
- centered SVG silhouette of a couple sitting together and watching the stars
- planted SVG flowers generated from `game.totalFlowers`

The visible garden uses net flowers after Evening Weed penalties. It caps the
rendered flowers for layout/performance, while the balance still shows the true
count.

`GardenPage` reads `getSpringArcProgress()` and sets CSS variables for fullness
(`--spring-aura-opacity`, `--spring-stage-saturation`, `--spring-hill-opacity`,
`--spring-hill-glow`, `--spring-flower-opacity`). These make the garden warmer
and richer as Spring approaches 100% while keeping the flower count tied to
`game.totalFlowers`.

## Ledger

`StatsPage` is the thin Hana wrapper for the shared period-aware Ledger. It is
reachable from the sticky action area on `HanaPage`, below the night-garden
action. The same information architecture powers Cramble, while profile props
keep the catalogs, saved histories, copy, momentum cue, and visual themes
separate.

`getHanaStats(state, quests)` derives stats from `createHanaCloudSyncPayload()`
so the UI matches the same normalized rows that are synced to Postgres.

Status interpretation:

- `completed` stays completed.
- `skipped` stays skipped.
- pending daily rows before `currentDate` become `missed`.
- pending daily rows on `currentDate` stay `open`.
- pending flexible-period rows stay open through their inclusive `dueDate` and
  become missed only after the whole period ends.
- pending long-term rows become `missed` only after `dueDate`.

The page has one `Archive index` / `Quest records` list. The former All Quests
and Evening Weeds navigation cards are no longer part of the Ledger. Evening
Weeds remain an end-of-day reflection on Hana's tracker and are not mixed into
scheduled habit analytics, because a weed observation has no target window or
missed state.

Every built-in and custom Hana habit comes from `getQuestCatalog(quests, game)`.
Each row shows cadence, the six most recent scoring windows, a 30-day target
rate, and a momentum cue. Locked catalog quests show their unlock level instead
of a misleading `0%`.

Opening a quest uses `getHabitRangeStats(..., 'hana', ..., range)` and the same
detail engine as Cramble. It provides:

- current-window progress and next due date
- selectable 7/30/90/All ranges
- targets met, exact record count, and weekly pace
- one token per complete scoring window
- a daily occurrence grid where repeated same-day records show their count
- neutral non-due days and non-punitive insight copy

Legacy long-term quests predate exact completion timestamps. Their goal-window
history remains accurate, but the detail page explicitly omits a fabricated
daily heatmap and explains that the exact completion day was not stored.

`getHabitMomentumSignal()` ignores open and skipped windows. Two trailing met
windows produce a `🔥 N combo` badge. If one unfinished window follows three met
windows, the badge remains `🔥 Strong rhythm`. Only three trailing unfinished
windows produce Hana's `🥀 Needs care`; new and mixed histories remain neutral.
The positive flame may also appear on an actionable quest card. The negative
cue is restricted to Ledger rows and detail headers so it does not shame someone
while they are trying to complete today's action.

Copy must remain non-guilting. Use language like "needs love", "soft signals",
and "gentler try" instead of failure/punishment wording.

## Leveling

Level thresholds are defined in `LEVEL_REQUIREMENTS` in `src/lib/hanaGame.ts`.
`getLevelProgress(totalFlowers)` returns:

- `level`
- `currentFloor`
- `nextTarget`
- `collectedThisLevel`
- `neededThisLevel`
- `percent`

The UI uses these to render the level badge and flower progress bar.

## Date-based daily rotation and long-term windows

The visible quest set is stored in state so checking a task never reshuffles
other tasks in the same render/day.

`syncActiveQuestPlan(state, quests)`:

- Creates `activeDailyQuests[currentDate]` if missing.
- Keeps valid existing daily quest ids for that date.
- Fills missing daily slots from the level-appropriate unlocked pool.
- Keeps valid existing long-term active ids.
- Fills missing long-term slots from the level-appropriate unlocked pool.
- Starts or renews long-term windows when missing/expired.

Quest counts by level:

- Level 1: **2 core daily**, **1 long-term**
- Level 2-4: **3 core daily**, **1 long-term**
- Level 5-7: **4 daily**, **2 long-term**
- Level 8+: **5 daily**, **3 long-term**

The Spring memory quest `remember-cramble` is layered on top of the core daily
count by `selectDailyQuestIds()`. It appears daily once unlocked but does not
push out health anchors like hydration, sunlight, or iron.

This gives a little daily variety while keeping the current day stable.

User-created habits are stored in `GameState.customHabits` and appended through
`getQuestCatalog(quests, state)`. They are required daily-group entries, so they
are never removed by the optional daily-card limit. The creation UI supports
two configurable patterns: once in a chosen number of days/weeks, or `x` times
in a chosen number of days/weeks. A one-week choice uses the Sunday-based
calendar week; every other custom period is anchored to the habit's creation
date. New definitions use `schedule.kind = 'periodTarget'`. See
[Custom Habits](custom-habits.md) for validation, cadence, reset, and persistence
rules.

Dates are stored as local `YYYY-MM-DD` tracking-day keys, not UTC ISO slices.
`todayKey()` uses a fixed local 04:00 boundary: 00:00â€“03:59 belongs to the
previous key, and 04:00 begins the next key. Date-key arithmetic remains based
on local calendar components so daylight-saving transitions do not change the
boundary by an elapsed-hour subtraction.

Long-term quests use `longTermWindows[questId] = startedAt`. The deadline is:

```ts
dueDate = startedAt + (durationDays - 1)
```

This means a 4-day task started on Monday is due by Thursday. Once the deadline
passes, `syncActiveQuestPlan()` starts a fresh window for that quest. Completed
old windows stay in history so earned flowers are retained.

## Health-report-informed task design

Hana's reports supplied by the user show:

- Low serum iron and low transferrin saturation.
- Vitamin D around the commonly cited insufficiency / sub-optimal range.
- Slightly high packed cell volume / RBC count, where hydration nudges are reasonable.

The app must NOT diagnose, prescribe supplements, or replace medical advice. It
uses conservative lifestyle nudges only:

- Iron/protein foods.
- Vitamin-C pairing with iron-focused foods.
- Tea/coffee spacing away from iron-focused meals.
- Gentle daylight exposure.
- Hydration.
- Realistic sleep hygiene that respects her late-night social life.
- A doctor-note task for asking a clinician about iron/vitamin D/supplements.
- Personality-aligned gentle tasks: daylight selfie, colorful plate, Cramble
  ping, body battery check, moon wash, slow sipping, stretching, one real meal,
  and snack shield.
- Hair-care self-care tasks: hair-wash hydration, silk/satin or loose-hair sleep,
  protein plate for hair, and weekly light oil/scalp massage. These are supportive
  routines only, not medical treatment for hair fall or deficiencies.

Psychology rule: start with very easy tasks, then unlock more tasks by level.
This follows tiny-habit behavior design: increase ability, anchor small actions,
and make the user feel successful instead of guilty.

## State model

```ts
type HanaGameState = {
  startDate: string | null
  currentDate: string // YYYY-MM-DD
  customHabits: CustomHabitQuest[]
  openActivities: OpenActivity[]
  openActivityLogs: Record<string, Record<string, number>>
  activeDailyQuests: Record<string, string[]>
  activeLongTermQuestIds: string[]
  dailyCompletions: Record<string, Record<string, boolean>>
  habitOccurrences: Record<string, Record<string, number>>
  longTermWindows: Record<string, string>
  longTermCompletions: Record<string, Record<string, boolean>>
  questSkips: Record<string, Record<string, boolean>>
  eveningWeeds: Record<string, Record<string, boolean>>
  totalFlowers: number
}
```

`startDate` is `null` until Hana presses **Start Health Overhaul**. It stores the
day the button was pressed. While it is `null`, the app may show preview/explore
state, but that state must not be saved to Postgres.

`dailyCompletions[dateKey][questId]` stores whether a daily task was completed
on a specific day. It remains the source for built-ins and legacy custom
schedules.

`habitOccurrences[dateKey][questId]` stores the number of records made that day
for a custom `periodTarget`. It supports multiple same-day records such as two
brushings per day without changing legacy boolean history.

`openActivities` and `openActivityLogs` store deadline-free check/count records.
They are kept outside the quest schedule and reward engine, so blank days never
become missed opportunities and logging does not change flowers, skips, Today
completion, or momentum. Positive values are still factual tracked-day evidence
for the Shared Journey. The shared Ledger renders their neutral 7/30/90/all-time
history without success-rate language.

`longTermWindows[questId]` stores the active start date for each long-term quest.

`longTermCompletions[questId][startedAt]` stores whether a long-term quest was
completed in a specific challenge window.

`questSkips[weekKey][skipEventKey]` stores weekly skips. `weekKey` starts on
Sunday via `getSkipWeekKey(currentDate)`. Skip event keys include the period:

- daily: `daily:<questId>:<dateKey>`
- long-term: `longTerm:<questId>:<startedAt>`

Hana has `WEEKLY_SKIP_LIMIT = 3`. Skipped quests count as resolved in the UI, give
0 flowers, and can be undone. Skips reset automatically because a new Sunday week
key starts a fresh skip bucket. Flexible `quota` and `periodTarget` habits cannot
consume skips because their outcome is evaluated across the whole period.

`eveningWeeds[dateKey][weedId]` stores voluntary end-of-day reflections.
Every 3 checked weeds wilt 1 flower from the net flower balance. The penalty is
calculated in `recomputeTotalFlowers()` via `getWiltedFlowerCount()`.

Current weed ids in `src/data/hanaWeeds.json`:

- `scroll-fog`
- `midnight-snack-vine`
- `sweet-sip-cloud`
- `hydration-drought`
- `phone-in-bed-ivy`

Checking an ordinary task toggles its boolean period bucket. Tapping a
`periodTarget` records one occurrence until the target is complete; **Undo one**
subtracts one current-day occurrence. Every mutation recomputes `totalFlowers`
from normalized history. A period target contributes exactly one difficulty
reward only when its count reaches the target, and undoing below the target
removes that reward. Partial progress has no penalty. This recomputation prevents
stale totals after migrations or catalog edits.

In production, Hana state is loaded from Postgres through `/api/hana-sync`.
Postgres is the source of truth. `localStorage` under `hana-game/v1` is the
profile cache, while `hana-game/pending-v1` durably marks the newest unsaved
snapshot so offline changes, including new habit definitions, upload before an
older database snapshot is accepted.

Before `startDate` exists, Home -> Hana shows `HanaStartPage`. The setup page can:

- commit today as Hana's first day, which atomically replaces Hana's old state
  and projections through a revision-checked POST
- open preview mode, which lets the app be explored without database writes

`saveHanaStateToDb()` rejects unstarted states, and the API route also rejects
`POST` payloads whose `state.startDate` is missing. There is no profile-wide
DELETE route; reset/start changes the history epoch and commits the replacement
snapshot and analytics rows in one transaction.

Saved state is normalized on load from both DB snapshots and local cache. The
previous single `completions[date][quest]` shape and the later
`weeklyCompletions` shape are migrated into daily/long-term buckets so older
progress does not crash the app. Snapshots that predate custom occurrence counts
or anytime logs default `habitOccurrences` and `openActivityLogs` to `{}`, and
`openActivities` to `[]`. Valid legacy `daily` and `quota` custom
habits retain their boolean completion and per-occurrence capped-reward behavior;
they are not silently reinterpreted as all-or-nothing period targets.

The database sync stores:

- a full `hana_state_snapshots` JSON backup for profile `hana`
- daily and long-term quest rows in `hana_quest_statuses`
- Evening Weed rows in `hana_weed_statuses`

Anytime logs live only in the canonical snapshot and exports; they deliberately
do not enter the scored quest-status projection.

See `docs/ai/database-sync.md` for the schema and Vercel deployment steps.

## Dev controls

The Hana page has local-only temporary controls, rendered behind
`import.meta.env.DEV`:

- **Next day:** increments `currentDate` by one day to test daily reset and long-term deadlines.
- **Reset:** clears boolean completions, scheduled occurrence counts, anytime
  log values, skips, weeds, and flowers while preserving custom definitions and
  the current simulated date.

They are hidden from production/Vercel builds but remain available during
`npm run dev`.
