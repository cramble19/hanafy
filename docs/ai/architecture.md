# Architecture (Technical)

Technical source of truth for the habit-tracker PWA. Keep this in sync with the
code and with the human-facing summary in [../human/overview.md](../human/overview.md).

## 1. Summary

An offline-first, installable **Progressive Web App (PWA)** for gamified habit
tracking. The website and the "installable phone app" are a single codebase: a
static site plus a web app manifest and a service worker. In production, Hana's
progress is stored **DB-first** in Postgres through a Vercel API route.
`localStorage` is only an offline/cache fallback. There is no login/auth.

## 2. Core principles

- **Offline-first:** the app shell is precached and works with no network.
- **DB-first:** Postgres is the source of truth whenever the app is online.
- **Offline fallback:** `localStorage` is only a temporary cache.
- **Small backend:** Vercel hosts serverless API routes for cloud persistence.
- **Minimalist:** mobile-first, few dependencies, small surface area.
- **Pure logic:** all gamification math lives in pure, testable functions.

## 3. Tech stack

| Concern | Choice | Notes |
|--------|--------|-------|
| Language | TypeScript (strict) | Type safety across the app |
| Build tool | Vite | Fast dev server, outputs static assets |
| UI framework | React 19 | Largest ecosystem |
| Styling | Tailwind CSS v4 | Via `@tailwindcss/vite` (CSS-first config, `@theme`) |
| Components | shadcn/ui (`new-york`) | Owned/restyled primitives; `npx shadcn@canary` for v4 |
| Icons | `lucide-react` | |
| Toasts | `sonner` | shadcn's recommended toast |
| State + persistence | React state + `localStorage` cache | DB snapshot hydrates UI; local cache is fallback |
| Backend | Vercel API routes | `api/hana-sync.ts` reads/writes Hana state |
| Database | Postgres via Neon/Vercel integration | Source of truth for Hana progress |
| Animation | `motion` (Framer Motion) | Micro-interactions |
| Celebration | `canvas-confetti` | Completion bursts |
| Dates | `date-fns` | Streak/date math |
| PWA | `vite-plugin-pwa` + `sharp` icon generation | Manifest, service worker (Workbox), icons |

All of the above are free or have suitable free tiers for a personal app. If
on-device cache grows large, migrate the fallback cache from `localStorage` to
IndexedDB (via `dexie`) while keeping Postgres as the source of truth.

## 4. Intended project structure

```text
src/
  main.tsx
  App.tsx
  components/
    ui/                 # shadcn primitives
    <feature components> # HabitCard, XpBar, StreakFlame, Heatmap, ...
  lib/
    gamification.ts     # pure XP / level / streak / achievement logic
    utils.ts            # cn() and helpers
  store/
    useHabitStore.ts    # Zustand store + persist middleware
  types.ts              # Habit, Profile, Achievement
  styles/globals.css    # Tailwind entry + theme tokens
api/
  hana-sync.ts          # Vercel serverless function for Postgres sync
public/                 # PWA icons, favicon
vite.config.ts          # React + Tailwind + VitePWA plugins
```

Personal static assets also live in `public/`. `public/couple-watercolor.png` is
used by the hidden home-page easter egg opened from the word "Whose".

## 5. Data model

```ts
type Habit = {
  id: string
  name: string
  emoji?: string
  color: string                 // accent used across the UI for this habit
  createdAt: string             // ISO
  completions: string[]         // 'YYYY-MM-DD' per completed day
  frequency: 'daily' | { daysOfWeek: number[] } // 0=Sun..6=Sat
}

type Profile = {
  xp: number
  achievements: string[]        // unlocked achievement ids
}

type Achievement = {
  id: string
  title: string
  description: string
  isUnlocked: (habits: Habit[], profile: Profile) => boolean
}
```

## 6. Gamification logic (pure functions in `lib/gamification.ts`)

- **XP:** `+10` per completion; milestone bonuses (e.g. +20 at 3/7/30-day streaks).
- **Level:** derived from XP, e.g. `level = floor(sqrt(xp / 50)) + 1`; expose
  `xpForLevel(level)` and `progressToNextLevel(xp)`.
- **Streak:** count of consecutive *scheduled* days up to today present in
  `completions` (respect `frequency`). Provide `currentStreak` and `longestStreak`.
- **Achievements:** data-driven list; each has an `isUnlocked` predicate checked
  after every state change; newly unlocked ids get added to `profile.achievements`.

Keep these functions free of React/store imports so they are trivially testable.

## 7. Persistence

- Hana state currently lives in `src/App.tsx`, but production startup hydrates it
  from Postgres via `src/lib/hanaRemoteState.ts`.
- `localStorage` under `hana-game/v1` is a cache/fallback only.
- `parseStoredHanaState()` normalizes/migrates older local shapes.
- `syncStateToDate()` moves persisted state to the real local date on production
  app launch/resume.
- `src/lib/hanaCloudSync.ts` converts state into database rows.
- `api/hana-sync.ts` reads/writes the DB snapshot and analytics rows.
- See [database-sync.md](database-sync.md) for table schemas and deployment.

## 8. PWA setup

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Manifest: `name`, `short_name`, `description`, `theme_color`, `background_color`,
  `display: 'standalone'`, `start_url: '/'`, and icons (192, 512, and a 512
  `maskable`). Generate PNG icons from `public/pwa-icon.svg` with
  `npm run icons`.
- Workbox: precache the app shell (`globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']`);
  no runtime API caching is needed (no backend).
- **Verify installability:** `npm run build && npm run preview`, then Chrome
  DevTools -> Lighthouse (PWA) and the Application tab. iOS installs via
  Share -> Add to Home Screen (no automatic prompt).

## 9. Hosting

HTTPS hosting is required for PWA install. Use **Vercel** for this project
because it hosts both the Vite frontend and the `api/` serverless route. Connect
a Postgres database through Vercel Storage / Marketplace, then redeploy so
`DATABASE_URL` or `POSTGRES_URL` is available to the API route.

## 10. Conventions

- Mobile-first, accessible (labels, focus states, contrast, large tap targets).
- Functional components; extract reusable logic into hooks.
- Business/gamification logic stays in `lib/` pure functions, not in components.
- Follow the design system in `.cursor/rules/design-system.mdc`.
- Every feature change updates BOTH `docs/human/<topic>.md` and
  `docs/ai/<topic>.md` (see `.cursor/rules/documentation.mdc`).
