# Design QA — Hana and Cramble shared profile surfaces

## Source visual

- Approved paired reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-e00f0010-2613-4e94-b21b-f1eb16057c87.png`
- Approved compact pill-card reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-59cce52f-1681-4ec1-8731-9a0a5aea6f0d.png`
- Approved narrower centered pill-card reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-71446066-4c50-4b1f-b0d2-d73a40ac761e.png`
- Approved icon-free anytime-log form reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-af1e5148-adac-4a8c-a5a9-285c81b543c9.png`
- Approved soft log-card prototype: `C:\Users\adityakumarj\.codex\visualizations\2026\08\19\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\soft-log-card-refinement.html`
- Approved sparse-state compact-mosaic prototype: `C:\Users\adityakumarj\.codex\visualizations\2026\08\19\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\compact-log-mosaic.html?rev=5`
- Approved transparent masthead reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-77a7200e-2646-489a-8142-ed9e3e1a58b0.png`
- User-supplied wallpaper: `C:\Users\ADITYA~1\AppData\Local\Temp\codex-clipboard-46b9141a-120f-4133-a75f-5b603c95fe4d.png`
- Targets: Hana's Today's activity log and Cramble's Today's field log.

## Implemented mapping

- Both `All / Unlogged / Logged` controls have no outer boundary or vertical dividers. The selected label uses the profile accent and a short underline; keyboard focus remains visible.
- Both boards are split into three-item mosaic groups. Each group has one 138px feature tile beside two centered 65px pills separated by 8px; the feature tile alternates left, right, left as groups continue.
- Rating activities receive the feature slot so the five-face scale remains readable and centered. Count activities can use either slot: feature counts keep the spacious layout, while compact counts stack their title and transparent 44px controls inside the 65px card.
- Three saved activities fill one complete group even when the set contains a rating, a check, and a count. A second rating starts a new group; later groups continue alternating feature placement.
- Compact check pills retain centered titles at a smaller, lighter optical weight. Partial groups keep their available half-width slots and never stretch a card across the full board.
- Every feature and compact mosaic card uses the same approved 28px corner radius in both profile themes.
- A single imported flower photograph is positioned in the shared results coordinate system. Every board card paints only its own card-sized crop, so cards reconstruct one continuous image while the page, margins, and gutters retain their profile background without duplicating full-board paint layers.
- Layout coordinates are recalculated after filtering, card-list changes, element resizing, and viewport resizing.
- Hana uses a light botanical treatment with green controls; Cramble uses a darkened archive treatment with brass controls.
- Activity emoji are not rendered on any Hana or Cramble log surface. Anytime-log icon selection and random assignment are removed from both Add/Edit forms. Legacy icon fields are accepted during snapshot normalization and discarded without altering the activity definition, ID, or recorded values; scheduled quest icons remain unchanged.
- Binary cards retain full-card tap/undo and hold-to-edit semantics and add a recorded-state ring.
- Count cards retain their independently operable minus/count/plus controls; hold, context-menu, and keyboard access preserve editing without a visible emoji/settings emblem.
- The older flat two-column pill layout and orphan-row stretching are removed; board shape now communicates visual rhythm through alternating feature and compact slots.
- One-time cards use a fully rounded pill boundary, centered medium-weight titles, and no status-circle ornament. Their recorded state settles through muted imagery, border, shadow, and title contrast while the full card remains the accessible Undo control.
- Count steppers keep their 44px tap targets and focus outlines while removing visible button and stepper fills, borders, shadows, and blur for a calmer transparent treatment.
- Recorded cards use a darker, less saturated crop while controls and focus states remain readable.
- The wallpaper is decorative CSS presentation only; it does not alter activity definitions, logs, callbacks, local storage, or cloud sync.
- Both tracker pages use one shared masthead component with equal left/right columns, keeping the lowercase profile name optically centered.
- Both masthead containers are transparent, allowing Hana's ivory page and Cramble's charcoal archive background to continue uninterrupted behind the same soft serif name treatment.
- Back navigation remains a 40px circular control at left; the right column is an empty balancing spacer with no level control or visible content.
- The hidden Home memory keeps its existing modal and Close action while crossfading between the watercolor and hands photograph every two seconds. It exposes no carousel controls and pauses rotation when the tab is hidden or reduced motion is requested.

## Verification

- Focused component tests verify wallpaper markup and emoji removal for both profiles, rating-face preservation, crop alignment math, alternating mosaic grouping, adjustable-log promotion, and existing gesture/control semantics.
- TypeScript: passed.
- Vitest: 36 files, 212 tests passed.
- Production build: passed; the existing chunk-size warning remains unchanged.
- Diff whitespace check: passed; repository line-ending notices remain unchanged.
- The optimized card and memory JPEGs are covered by the PWA image precache pattern.
- Local preview: `http://localhost:5173/`.

## Visual comparison

- Implementation screenshot: unavailable to this task. The selected Codex in-app browser can display the localhost build but does not expose a screenshot/DOM-inspection tool back to the agent.
- Playwright or another browser was not substituted because the Product Design workflow requires explicit approval before changing from the user's chosen browser.
- The approved source prototype is available, and localhost responds successfully. A side-by-side pixel comparison remains blocked until the chosen in-app browser exposes an implementation screenshot back to the task.

**Final result: blocked for pixel-level visual QA; functional, structural, responsive-layout, and build verification passed.**
