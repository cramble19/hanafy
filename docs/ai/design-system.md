# Design System — Calm Garden (Technical)

Authoritative implementation rules for Hanafy's shared foundation and its two
profile variants. Tokens and component styling live in
`src/styles/globals.css`.

## Direction

Hanafy should feel calm, warm, personal, and quietly rewarding—never like an
arcade or productivity dashboard. The shared interaction model stays
mobile-first; each profile may scope its own light or dark surface palette.
Identity comes from color, copy, and restrained original motifs, not from
changing interaction behavior.

```text
Calm Garden foundation
├─ Hana: Spring Garden (flowers, sunlight, moonlit Garden)
└─ Cramble: Sunward Archive (archive dusk, brass, Observatory)
```

Hana's Garden and Cramble's Observatory remain their deepest reward scenes, but
Cramble's everyday Archive also uses a restrained dark palette.

## Shared tokens

Default tokens on `:root`:

```css
--canvas: #fffaf0;
--surface: #ffffff;
--surface-2: #fdf3e3;
--ink: #2b2620;
--muted: #7c7264;
--faint: #a99f8e;
--border: rgba(90, 65, 25, 0.1);
--success: #78ab63;
--warning: #e7a53c;
--danger: #d76a54;
--radius-lg: 20px;
--radius-md: 12px;
```

`@theme inline` exposes these to Tailwind utilities such as `bg-canvas`,
`bg-surface`, `text-ink`, `text-muted`, `border-border`, `rounded-card`, and
`rounded-control`. Prefer scoped CSS variables and these utilities over raw
colors inside JSX.

## Typography and layout

- Use Inter Variable only.
- Establish hierarchy with size, weight, case, and tracking; no display font.
- Main tracker width: `max-w-md` with 20px (`px-5`) screen gutters.
- Use the 4px spacing scale; cards normally have 16–24px padding.
- Use tabular numbers for rewards, rank/level, and statistics.
- Keep one primary action per screen and progressive disclosure for details.
- Cards use approximately 20px corners, controls 12px, and circular icon buttons.
- Borders are hairlines. Shadows are subtle; do not use heavy elevation.
- Component/text gradients are prohibited. A restrained ambient canvas glow or
  illustrative reward-scene gradient is allowed.

## Shared interaction components

`QuestCard` owns ordinary whole-card completion toggling, period-target
**Record +1** and **Undo one** controls, the separate Skip control, keyboard
behavior, reward output, and completion feedback. Counted cards show numeric
progress and label rewards as available only **at goal**. `QuestSection` owns
section labeling and cards. Profile copy and motifs enter through props:

- `variant="garden" | "archive"`
- singular/plural reward label
- completion verb

Do not fork accessibility or tap behavior to create a visual variant.

`HabitMomentumBadge` is shared by both profiles. Emoji are decorative; the
adjacent label and full `aria-label` explain the state. Combo uses a restrained
flame motion, disabled under `prefers-reduced-motion`. Negative motivation stays
small and contextual—never a full red card, ranking, global failure count, or an
action-surface warning. Garden uses `🥀 Needs care`; Archive uses `🕯️ Rekindle`.

`AddHabitDialog` is also shared. Its full-width trigger is the first item in each
sticky bottom dock. The native `<dialog>` supplies modal semantics, Escape, and
focus containment; the component restores opener focus, locks background scroll,
supports backdrop dismissal, and announces field-specific errors. Keep its
inputs and actions at least 44px high. It exposes the two shared patterns (once
per period and several times), configurable days/weeks, and an explicit
all-or-nothing reward summary. Vary only the Garden/Archive icon, reward word,
and scoped colors.

## Hana variant

`.hana-spring-shell` uses the shared warm canvas with floral accent colors and a
restrained spring decorative layer. Completed quests receive a gentle green wash,
small bloom details, and flower language. The mini Garden preview and sticky
Garden/Ledger actions connect to the dedicated reward and history pages.

`.hana-ledger-shell` and `.cramble-archive-shell` share the Ledger's structure,
range controls, target-window strip, activity grid, and accessible status
language. Hana maps those primitives to cream glass cards, leaf green, lavender,
and botanical corners; Cramble keeps charcoal, brass, moss, and codex corners.
Do not fork the scoring or range behavior when changing either theme.

Hana's Garden may be dark because it is a reward visualization. Net flowers must
control the visible planting/fullness, with written values alongside imagery.

## Cramble variant

`.cramble-archive-shell` locally overrides the shared variables toward warm
charcoal, dark archive cards, parchment text, brass, ember, indigo, moss, plum,
and blue. Motifs may include solar compasses, lanterns, keys, celestial charts,
floating page corners, geometric sigils, and an original sword/ember forge mark.

Required boundaries:

- Keep everyday archive pages gently dark, readable, and distinct from the
  still-deeper Observatory.
- Keep cards flat and readable; avoid leather textures, ornate frames, or busy
  medieval decoration.
- Preserve Inter, `max-w-md`, common spacing, radii, focus rings, and card behavior.
- Use original fantasy copy and symbols. Never reproduce franchise characters,
  house crests, sorting rituals, logos, quotes, names, or recognizable props.
- Chronicle lines should be concise and improvement-oriented, with epic-fantasy
  imagery and only indirect hope about changed paths; never name a breakup.
- Completed quests use renown/archive language rather than flower language.

`.cramble-observatory-shell` is the deepest Cramble surface. Its code-native
scene may use a dusk sky, mountains, a winding road, overlook, lantern/fire, and
original figure silhouettes. One traveler remains fixed near the origin while a
sword-bearing knight advances and scales down with earned journey progress. Both
figures must remain visible at every endpoint. The illustration is decorative
and `aria-hidden`; the adjacent percentage, rank, renown, landmark, and
progressbar remain authoritative.

## Motion

- Feedback transitions: 120–240ms.
- Ambient movement, where present, must be slow, faint, and pointer-free.
- The Cramble forge mark may animate only transform/opacity/color; sparks are
  faint, noninteractive, and suppressed in reduced-motion mode.
- The Observatory knight may use only a 120–240ms position/scale transition after
  real progress changes; never animate an endless walking loop. Reduced motion
  removes interpolation while preserving the correct final position.
- No flashing, flickering, endless attention-seeking particles, or layout motion.
- `prefers-reduced-motion: reduce` must remove nonessential animations and
  transforms. Functional state changes remain immediate and understandable.

## Honest gamification

- A flower, renown point, rank, level, bar, or star must derive from recorded
  quest completion—not decorative taps.
- Observatory distance derives only from the current recorded renown total;
  rank is milestone context and must not be double-counted into movement.
- A skip is neutral and guilt-free; it earns no reward.
- Do not use loss aversion, leaderboards, shame copy, or fake urgency.
- Missing days use return-oriented language.
- State must never be communicated by color alone; pair it with text, icon,
  checked state, fill, or shape.

## Accessibility

- Text contrast at least 4.5:1 for normal text.
- Interactive targets at least 44×44 CSS pixels.
- Visible `:focus-visible` treatment on every control.
- Semantic buttons/forms/headings and accurate accessible names.
- Password errors should be associated with the input and announced.
- Decorative layers use `pointer-events: none` and are hidden from assistive tech.
- Do not place essential information only in a generated visual.

## Implementation workflow

- Use Tailwind v4 utilities and the existing small React components; the project
  does not currently use shadcn/ui.
- Use Lucide icons for interface symbols. Existing code-native marks and CSS
  scene decoration are allowed.
- Prefer profile-scoped selectors so a Cramble token cannot leak into Hana.
- Reuse behavior; vary tokens, motifs, and copy.
- Update this spec whenever a genuine design-system capability changes.

## References

Legacy approved mockups are stored in `docs/design/references/`. They remain useful
for Calm Garden/Hana foundations. The implemented Cramble variant in
`src/styles/globals.css` and the Cramble docs are its current source of truth.
