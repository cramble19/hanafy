# Architecture (Technical)

Technical source of truth for Hanafy. Keep it aligned with
[../human/overview.md](../human/overview.md).

## Summary

Hanafy is a mobile-first React PWA with two isolated habit-game profiles in one
frontend:

```text
Home
├─ Hana -> start/preview -> Spring tracker -> Garden / Ledger
└─ Cramble -> client gate -> First Oath -> Archive tracker -> Observatory / Ledger
```

Production is DB-first: a Vercel function persists both profiles in Postgres.
Each profile has a distinct local cache for offline fallback. There is no account
authentication; Cramble's static password is only a client-side navigation gate.

## Runtime stack

| Concern | Implementation |
|---|---|
| Language | strict TypeScript |
| UI | React 19 functional components |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 plus scoped CSS in `src/styles/globals.css` |
| Icons | `lucide-react` plus small existing code-native marks |
| State | React state/refs; no external store |
| Tests | Vitest |
| PWA | `vite-plugin-pwa`; icons generated with `sharp` |
| API | Vercel function `api/hana-sync.ts` |
| Database | Postgres through `@neondatabase/serverless` |

Do not document or assume Zustand, shadcn/ui, Sonner, Framer Motion,
canvas-confetti, or date-fns; they are not installed.

## Source layout

```text
src/
  App.tsx                         # Home + Hana controller + top-level views
  features/cramble/
    CrambleExperience.tsx         # isolated Cramble controller and views
  components/
    AddHabitDialog.tsx            # shared accessible creation form
    QuestCard.tsx                 # shared interaction, garden/archive variants
    QuestSection.tsx
    EveningWeeds.tsx              # Hana only
  data/
    hanaTasks.json, quests.ts
    hanaWeeds.json, springQuotes.json
    crambleTasks.json, crambleQuests.ts, crambleChronicles.json
  lib/
    customHabits.ts               # custom input validation and quest creation
    hanaGame.ts                   # shared pure date/quest/reward engine
    hanaCloudSync.ts              # profile-aware payload generation
    hanaRemoteState.ts            # profile-aware GET/POST/DELETE helpers
    hanaStats.ts                  # shared profile, period-window, and Ledger stats
    crambleGame.ts                # Cramble gate/cache/chapter rules
  pages/                          # profile-specific screen components
  styles/globals.css              # tokens, Tailwind entry, variants, reward scenes
  types.ts                        # Quest, GameState, compatibility aliases
api/
  hana-sync.ts                    # shared profile-partitioned sync endpoint
public/                           # PWA icons and static assets
```

## Navigation

There is no routing dependency. `App.tsx` uses a finite `View` union. Hana views
remain under `App` because its controller predates the profile split. Cramble is
mounted only in `CrambleExperience`; its internal tracker, Observatory, and Ledger
use a separate local view union.

Returning from Cramble to Home unmounts that controller and discards unlock state.
Selecting Cramble again always returns to the password gate.

## Data model and game engine

`GameState` is the persisted profile snapshot:

```ts
type GameState = {
  startDate: string | null
  currentDate: string
  customHabits: CustomHabitQuest[]
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

`HanaGameState` remains an alias so existing Hana code and stored data are stable.
Cramble uses the same compatible state shape but interprets `totalFlowers` as
renown and leaves `eveningWeeds` empty.

Pure functions in `hanaGame.ts` own date keys, level/reward math, quest rotation,
long-term windows, cadence eligibility/progress, skip keys, state normalization,
and total recomputation. Every call that derives an active plan or parses stored
state must receive the correct profile catalog.

Daily-group quests may omit `schedule` for legacy daily behavior, or declare a
daily, exact-weekday, current `periodTarget`, or legacy `quota` schedule. A
`periodTarget` represents both user-facing modes: once per chosen period is
`target: 1`, while several times per period is `target: x`. One-week targets use
a Sunday-based calendar window; all other custom day/week periods use rolling
windows anchored to the habit's creation date.

Ordinary and legacy completion truth remains in
`dailyCompletions[date][questId]: boolean`. New counted custom records live in
`habitOccurrences[date][questId]: number`, allowing multiple records on one day.
A current period target awards one difficulty reward only after its full count,
with no partial reward or penalty. Legacy quotas preserve their target-capped
per-occurrence rewards. Analytics use one aggregate row per flexible period
rather than one apparent miss per day.

`GameState.customHabits` stores user-created definitions. The effective catalog
is always `getQuestCatalog(baseQuests, state)`, with built-ins first and valid
custom habits appended. Cramble's built-in catalog contains four daily habits
plus one Sunday habit and no long-term/rotating entries; either started profile
can add a deliberate once-or-several-times goal in a configurable number of days
or weeks. See
[custom-habits.md](custom-habits.md).

## Profile isolation

| Boundary | Hana | Cramble |
|---|---|---|
| Controller | `App.tsx` | `CrambleExperience.tsx` |
| Catalog | `quests` | `crambleQuests` |
| Cache key | `hana-game/v1` | `cramble-game/v1` |
| Durable pending key | `hana-game/pending-v1` | `cramble-game/pending-v1` |
| DB profile | `hana` | `cramble` |
| Reward page | Garden | Observatory |
| History | Ledger with garden theme | Ledger with archive theme |

Each controller owns its own React state, current-state ref, pending-save ref,
in-flight-save ref, sync status, start flow, and cache helpers. Never share a save
queue between profiles. Generic sync functions require an explicit profile and
catalog for Cramble.

## Persistence

- Production startup loads the selected profile from `/api/hana-sync`.
- A valid online DB snapshot overrides the local cache.
- A successful empty DB result clears only that profile's cache and shows its
  start page.
- Offline/load-error fallback may use that profile's local cache.
- Started changes update React/cache optimistically and serialize background
  writes so stale requests cannot overtake the newest queued snapshot.
- Each profile durably marks the newest unsaved snapshot and flushes it before
  online hydration, including after leaving or reloading the screen.
- Local development disables remote calls and uses local caches only.
- `startDate` prevents an unstarted/preview state from becoming authoritative.

See [database-sync.md](database-sync.md) for API and schema details.

## PWA and hosting

`vite.config.ts` configures React, Tailwind, and an auto-updating PWA service
worker. Workbox precaches static app-shell assets; it does not cache the API.
Vercel is the intended host because it serves both `dist/` and `api/`. The API
requires `DATABASE_URL` or `POSTGRES_URL`.

## Security boundary

Allowed profile ids and row/profile equality are validated to prevent accidental
cross-profile writes. This is data partitioning, not authorization. GET, POST,
and DELETE have no authenticated identity. `CRAMBLE_PASSWORD` ships in the JS
bundle and localStorage is plaintext. Add server-side sessions and authenticated,
profile-scoped API checks before public or sensitive use.

## Engineering conventions

- Keep profile-specific controllers and catalogs isolated.
- Keep date/reward/selection/stat computations pure and testable.
- Pass the active catalog explicitly across generic boundaries.
- Preserve optimistic 44px interactions and visible focus states.
- Use the shared Calm Garden foundation and documented profile variants.
- Prefer existing dependencies and code-native CSS/icons.
- Every feature change updates both human and AI documentation tracks.
