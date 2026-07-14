# Hana Game Logic (Technical)

Technical source of truth for Hana's flower-based game loop.

## Files

- `src/data/hanaTasks.json` — editable task catalog. Add/remove tasks here.
- `src/data/hanaWeeds.json` — editable end-of-day reflection catalog.
- `src/data/springQuotes.json` — editable Spring quote / April-inspired note catalog.
- `src/data/quests.ts` — typed loader for the JSON catalog.
- `src/lib/hanaGame.ts` — pure game/date/rotation/level helpers.
- `src/lib/hanaCloudSync.ts` — converts local Hana state into database sync rows.
- `src/lib/hanaStats.ts` — derives user-facing stats from the same normalized rows.
- `src/App.tsx` — owns Hana's current game state and persistence.
- `api/hana-sync.ts` — Vercel API route that stores Hana history in Postgres.
- `src/pages/HanaStartPage.tsx` — start-date gate before Hana's tracker.
- `src/pages/HanaPage.tsx` — renders the game UI, task sections, dev controls.
- `src/pages/GardenPage.tsx` — renders the dedicated night-garden reward page.
- `src/pages/StatsPage.tsx` — renders Hana's garden-journal stats view.
- `src/pages/QuestStatsPage.tsx` — lists every quest with total done/skipped/shown counts.
- `src/pages/QuestDetailPage.tsx` — shows one quest's totals and calendar trail.
- `src/pages/WeedStatsPage.tsx` — lists every Evening Weed with total checks.
- `src/pages/WeedDetailPage.tsx` — shows one weed's total checks and calendar trail.
- `src/components/QuestCard.tsx` and `src/components/QuestSection.tsx` — task UI.

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

## Stats page

`StatsPage` is reachable from the sticky action area on `HanaPage`, below the
night-garden action. It should feel like a soft garden journal, not an analytics
dashboard.

`getHanaStats(state, quests)` derives stats from `createHanaCloudSyncPayload()`
so the UI matches the same normalized rows that are synced to Postgres.

Status interpretation:

- `completed` stays completed.
- `skipped` stays skipped.
- pending daily rows before `currentDate` become `missed`.
- pending daily rows on `currentDate` stay `open`.
- pending long-term rows become `missed` only after `dueDate`.

The page shows:

- overall completion rhythm
- current-week day petals
- a link to all quest rows and quest-specific detail pages
- a link to all weed rows and weed-specific detail pages
- quest detail calendars where green = completed, gold = skipped, pink = missed
- weed detail calendars where green = checked

`getQuestHistory(state, quests, questId)` and `getWeedHistory(state, weedId)` live
in `src/lib/hanaStats.ts`. `getCalendarWindow(currentDate)` returns the recent
35-day window used by detail calendars.

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

Dates are stored as local `YYYY-MM-DD` keys, not UTC ISO slices, to avoid
off-by-one behavior around local midnight.

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
  activeDailyQuests: Record<string, string[]>
  activeLongTermQuestIds: string[]
  dailyCompletions: Record<string, Record<string, boolean>>
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
on a specific day.

`longTermWindows[questId]` stores the active start date for each long-term quest.

`longTermCompletions[questId][startedAt]` stores whether a long-term quest was
completed in a specific challenge window.

`questSkips[weekKey][skipEventKey]` stores weekly skips. `weekKey` starts on
Sunday via `getSkipWeekKey(currentDate)`. Skip event keys include the period:

- daily: `daily:<questId>:<dateKey>`
- long-term: `longTerm:<questId>:<startedAt>`

Hana has `WEEKLY_SKIP_LIMIT = 3`. Skipped quests count as resolved in the UI, give
0 flowers, and can be undone. Skips reset automatically because a new Sunday week
key starts a fresh skip bucket.

`eveningWeeds[dateKey][weedId]` stores voluntary end-of-day reflections.
Every 3 checked weeds wilt 1 flower from the net flower balance. The penalty is
calculated in `recomputeTotalFlowers()` via `getWiltedFlowerCount()`.

Current weed ids in `src/data/hanaWeeds.json`:

- `scroll-fog`
- `midnight-snack-vine`
- `sweet-sip-cloud`
- `hydration-drought`
- `phone-in-bed-ivy`

Checking a task toggles its period bucket and then recomputes `totalFlowers` from
all completions. This prevents stale flower totals after migrations or task
catalog edits.

In production, Hana state is loaded from Postgres through `/api/hana-sync`.
Postgres is the source of truth. `localStorage` under `hana-game/v1` is only a
fallback cache for offline or failed-network moments.

Before `startDate` exists, Home -> Hana shows `HanaStartPage`. The setup page can:

- commit today as Hana's first day, which clears Hana's old DB rows and saves a
  fresh started state
- open preview mode, which lets the app be explored without database writes

`saveHanaStateToDb()` rejects unstarted states, and the API route also rejects
`POST` payloads whose `state.startDate` is missing. `DELETE /api/hana-sync`
clears the profile snapshot and analytics rows before the first committed start.

Saved state is normalized on load from both DB snapshots and local cache. The
previous single `completions[date][quest]` shape and the later
`weeklyCompletions` shape are migrated into daily/long-term buckets so older
progress does not crash the app.

The database sync stores:

- a full `hana_state_snapshots` JSON backup for profile `hana`
- daily and long-term quest rows in `hana_quest_statuses`
- Evening Weed rows in `hana_weed_statuses`

See `docs/ai/database-sync.md` for the schema and Vercel deployment steps.

## Dev controls

The Hana page has local-only temporary controls, rendered behind
`import.meta.env.DEV`:

- **Next day:** increments `currentDate` by one day to test daily reset and long-term deadlines.
- **Reset:** clears `localStorage` and resets Hana's flowers/completions.

They are hidden from production/Vercel builds but remain available during
`npm run dev`.
