# Design System — "Calm Garden" (Technical Spec)

Authoritative, token-level source of truth for the app's UI/UX. UI/UX is the
**highest priority** of this project. The concise, always-on version of these
rules is the Cursor rule [.cursor/rules/design-system.mdc](../../.cursor/rules/design-system.mdc);
this document holds the exact values. Plain-language version:
[../human/design.md](../human/design.md). Visual references:
[../design/references/](../design/references/).

> Design tokens now live in `src/styles/globals.css` — that file is canonical for
> the exact values. Keep this document in sync with it (it holds the rationale and
> usage rules).

## 0. Direction

"Calm Garden" with a **flowers-and-sunlight** mood: a warm, bright, minimal core
(think Streaks x Things x a wellness app) with **light, honest gamification**.
Zen garden, never arcade.

The app is **light by default** — a warm sunlit cream canvas with a soft sun-glow,
never a dark or heavy screen. A dark theme is kept in the tokens but deferred to
later theming (see the phased plan). Floral, sunny accent colors provide the color;
the chrome stays warm and quiet.

Principles: reduce to essentials; whitespace is an active element; one primary
action per screen; one typeface; warm chrome + a single **per-habit** accent;
feedback-only motion; kindness over punishment.

Hana's Spring page may use a restrained ambient decorative layer: slow drifting
petals behind the cards. Keep page edges clean; avoid side vines/leaves if they
compete with the cards. Decorative elements must be `aria-hidden`,
`pointer-events: none`, visually secondary, and disabled by
`prefers-reduced-motion`.

## 1. Color

Never hardcode colors in components — consume the tokens below (as CSS variables
/ Tailwind theme tokens). Light is the default theme; dark values are retained for
later theming.

### Neutrals

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--canvas` | `#FFFAF0` | `#0A0A0A` | App background (warm sunlit cream / near-black) |
| `--surface` | `#FFFFFF` | `#161616` | Cards, sheets |
| `--surface-2` | `#FDF3E3` | `#1F1F1F` | Subtle warm fills, pressed states |
| `--ink` | `#2B2620` | `#FAFAF9` | Primary text, icons (warm near-black) |
| `--muted` | `#7C7264` | `#A1A1A1` | Secondary text, inactive tabs |
| `--faint` | `#A99F8E` | `#6B6B6B` | Tertiary text, captions |
| `--border` | `rgba(90,65,25,0.10)` | `rgba(255,255,255,0.10)` | Warm hairline borders/dividers |

> Background: over `--canvas`, the page layers a soft sunlight glow on `body` —
> `radial-gradient(1100px 520px at 50% -10%, #FFF0C4 0%, transparent 60%)` — for the
> sunlit feel (light theme only).

### Semantic (muted, accessible)

| Token | Value | Use |
|-------|-------|-----|
| `--success` | `#78AB63` | Completion, positive streak (leaf green) |
| `--warning` | `#E7A53C` | Caution (sunflower) |
| `--danger` | `#D76A54` | Destructive (delete, warm coral) |

### Per-habit accent palette

Each habit stores its own `color`. The **app chrome stays warm/neutral**; a habit's
color appears ONLY inside its own surfaces (progress ring, streak flame, filled
check, habit-detail header). Offer these floral/sunny swatches in the add/edit sheet:

| Name | Hex | Name | Hex |
|------|-----|------|-----|
| Sunflower | `#EEA63A` | Rose | `#D98BA0` |
| Leaf | `#78AB63` | Lavender | `#9E8FD0` |
| Sky | `#6EA3C4` | Terracotta | `#CB7E5C` |
| Sage | `#8FB48A` | Peach | `#E8946A` |

### Color rules

- One accent visible per surface (the habit's own). Never a second accent.
- Accent is reserved for interactive / active / progress elements — never large flood fills.
- Never signal state with color alone (pair with icon, label, or fill state).
- The primary app CTA / FAB uses `--ink` (warm near-black in light, off-white in dark), not an accent.

## 2. Typography

- **One family:** `Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`.
  Hierarchy comes from weight/size only — never add a second display font.
- **Tabular numbers** for streaks, XP, counts, and stats: `font-variant-numeric: tabular-nums`.

| Step | Size | Line height | Typical use |
|------|------|-------------|-------------|
| xs | 12px | 1.4 | Captions, eyebrow labels (uppercase, `+0.06em` tracking) |
| sm | 14px | 1.45 | Secondary text, streak counts |
| base | 16px | 1.5 | Body (minimum body size) |
| lg | 18px | 1.4 | Card titles, list items |
| xl | 20px | 1.3 | Section headers |
| 2xl | 24px | 1.2 | Screen subtitles |
| 3xl | 32px | 1.15 | Screen titles (e.g. "Today") |

- Weights: `400` body, `500` labels/medium, `600` headings; `700` used sparingly.
- Tracking: `-0.02em` on 24px+ headings; `0` on body; `+0.06em` on uppercase eyebrow labels.

## 3. Spacing

4px base scale — use only these steps: **4, 8, 12, 16, 20, 24, 32, 48, 64**.

- Card padding: `16-20`. Screen gutters: `20`. Gap between cards: `12-16`.
- Section vertical gap: `24-32`. Prefer `gap-*` (flex/grid) over ad-hoc margins.

## 4. Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 8px | Chips, small tags |
| `--radius-md` | 12px | Buttons, inputs, tab items |
| `--radius-lg` | 20px | Cards, sheets, stat tiles |
| `--radius-full` | 9999px | Rings, avatars, checks, XP bar, FAB, pills |

## 5. Elevation & borders

- Definition comes from **hairline borders first** (`--border`), elevation second.
- Light shadows only (never heavy drops):
  - `--shadow-card`: `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)`
  - `--shadow-float` (FAB, sheets, popovers): `0 8px 24px rgba(0,0,0,0.08)`
- Gradients: a single subtle **ambient background glow** on the canvas is allowed
  (the sunlight glow); component and text fills stay flat — no gradient fills.
- Dark mode: rely on `--surface`/`--surface-2` lightness + border; minimize shadow.

## 6. Motion

Motion is mostly **feedback only**. The only decorative exception is restrained
seasonal ambience on Hana's Spring page, and it must stay slow, subtle, and
non-interactive.

- Durations: fast `120ms`, base `180ms`, slow `240ms`; celebration up to `900ms`.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for enter/among UI; spring for check-off / ring-fill.
- Interactions:
  - Check off: whole quest card toggles completion; completed cards get a soft
    green wash, tiny bloom sparkles, and a small `+N flowers planted` feedback pill.
  - Card press: scale `0.98`.
  - Flower gain: bar width transitions + short planted-flower copy.
  - Milestone / goal reached: brief `canvas-confetti` burst (< 900ms).
- **`prefers-reduced-motion`: always respected** — disable transforms and confetti,
  keep instant opacity changes. Celebrations are also toggleable in Settings.

## 7. Iconography

- `lucide-react`, stroke width `1.75`, sizes `20`/`24`, rounded caps. Consistent set.
- Habit avatars use **emoji** (personal, colorful, zero assets).

## 8. Gamification components (honest)

Anchor EVERY element to a real completed action stored in the data model — never
to taps or logins.

- **Progress ring:** SVG circle; track = `--border`, progress = habit color,
  rounded linecap. Fills on completion; also renders daily-goal percentage.
- **Streak:** flame icon + tabular number. Grows subtly. **Never punitive** — no
  guilt copy; a missed day offers a gentle "streak freeze" (limited) or "start fresh".
- **Flower bar:** slim (`8px`), `--radius-full`, `--success` fill; labels use
  flower counts, not XP.
- **Level display:** keep level visible in progress cards; avoid large circular
  level badges on the main deployed Hana page.
- **Badges / achievements:** grid of chips. Locked = outlined + lock + greyscale
  icon. Unlocked = soft fill + colored icon + title + one-line description.
  Unlock -> `sonner` toast + short celebration. Reserve for meaningful milestones only.
- **Heatmap:** weeks x days grid, single hue (`--success` or per-habit color) at
  4 intensity levels + a Less->Most legend.
- **Rollout order (restraint):** ship rings + streaks + XP first; add badges +
  heatmap next. Never surface all mechanics at once. No leaderboards.

## 9. Layout, navigation & screens

- **Sticky Garden action:** Hana's main page may use a soft sticky bottom action
  that opens the night garden and shows flower/skip context.
- **Mini garden preview:** a compact SVG night-garden preview can sit near the
  flower balance card. It should use illustrated flowers and moon shapes, not emoji clutter.
- **Section dividers:** use tiny stem/petal dividers under section titles instead
  of heavy rules.
- **Today (hero):** header (arc eyebrow, "Today" title, date), flower balance,
  slim flower bar, list of quest cards, and Garden access.
- **Progress:** current/longest streak stat tiles, heatmap, "This week" bar chart,
  achievements grid.
- **Profile / Settings:** level + XP summary; theme (light by default, more later);
  motion & celebration toggle; local data export/reset; about.
- **Add / edit habit:** bottom sheet — name, emoji picker, color swatches (palette
  above), frequency (daily / days-of-week), save/delete.
- **Empty state:** friendly and memorable — a warm line + primary "Add your first habit".

## 10. Accessibility (required)

- Contrast >= `4.5:1` for text, `>= 3:1` for large text / UI; verify every accent on the canvas.
- Tap targets `>= 44px`. Visible focus rings (`2px`, offset).
- Never color-only signaling. Respect `prefers-reduced-motion`.
- Use `rem` units so Dynamic Type scaling reflows cleanly.
- Semantic HTML; `aria-label` on all icon-only buttons.

## 11. Implementation notes (Tailwind v4)

- Define tokens as CSS variables in `src/styles/globals.css`; expose to Tailwind
  via `@theme inline`. Keep the `.dark` override block for later theming.
- Default theme = **light** (warm sunlit cream). Do NOT auto-switch to system dark;
  a theme choice will be persisted in the store when theming lands (later phase).
- Use shadcn/ui primitives and restyle to these tokens; do not hand-roll primitives.
- Keep components small and composable; keep logic out of them (see `lib/`).

## 12. Reference mockups

The approved Calm Garden mockups (visual reference):

- [../design/references/mockup-today-light.png](../design/references/mockup-today-light.png)
- [../design/references/mockup-progress-light.png](../design/references/mockup-progress-light.png)
- [../design/references/mockup-today-dark.png](../design/references/mockup-today-dark.png) (dark reference, retained for future theming)

Note: the current build warms these toward the flowers-and-sunlight palette above
(sunlit cream canvas + sun-glow). Refresh these mockups when the themed screens are built.
