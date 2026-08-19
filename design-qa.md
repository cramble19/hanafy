# Design QA — Hana and Cramble shared profile surfaces

## Source visual

- Approved paired reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-e00f0010-2613-4e94-b21b-f1eb16057c87.png`
- Approved compact pill-card reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-59cce52f-1681-4ec1-8731-9a0a5aea6f0d.png`
- Approved narrower centered pill-card reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-71446066-4c50-4b1f-b0d2-d73a40ac761e.png`
- Approved transparent masthead reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-77a7200e-2646-489a-8142-ed9e3e1a58b0.png`
- User-supplied wallpaper: `C:\Users\ADITYA~1\AppData\Local\Temp\codex-clipboard-46b9141a-120f-4133-a75f-5b603c95fe4d.png`
- Targets: Hana's Today's activity log and Cramble's Today's field log.

## Implemented mapping

- Both `All / Unlogged / Logged` controls have no outer boundary or vertical dividers. The selected label uses the profile accent and a short underline; keyboard focus remains visible.
- Both boards use two columns in DOM order. Binary logs occupy one column, count logs span both columns, and an orphaned final binary log in a run spans the row so mixed log types never leave an accidental empty cell.
- A single imported cosmos image is positioned in the shared results coordinate system. Every board card paints only its own card-sized crop, so cards reconstruct one continuous image while the page, margins, and gutters retain their profile background without duplicating full-board paint layers.
- Layout coordinates are recalculated after filtering, card-list changes, element resizing, and viewport resizing.
- Hana uses a light botanical treatment with green controls; Cramble uses a darkened archive treatment with brass controls.
- Activity emoji are not rendered on Hana or Cramble log cards. Their saved metadata remains intact for backward compatibility and exports.
- Binary cards retain full-card tap/undo and hold-to-edit semantics and add a recorded-state ring.
- Count cards retain their independently operable minus/count/plus controls; hold, context-menu, and keyboard access preserve editing without a visible emoji/settings emblem.
- Paired tap-only logs use equal compact pill-shaped rectangles centered within narrower column widths. When the final tap-only log has no partner, it spans the row but remains a narrower centered pill. Titles and recorded-state circles share the vertical midpoint in both layouts.
- Recorded cards use a darker, less saturated crop while controls and focus states remain readable.
- The wallpaper is decorative CSS presentation only; it does not alter activity definitions, logs, callbacks, local storage, or cloud sync.
- Both tracker pages use one shared masthead component with equal left/right columns, keeping the lowercase profile name optically centered.
- Both masthead containers are transparent, allowing Hana's ivory page and Cramble's charcoal archive background to continue uninterrupted behind the same soft serif name treatment.
- Back navigation remains a 40px circular control at left; the right column is an empty balancing spacer with no level control or visible content.

## Verification

- Focused component tests verify wallpaper markup and emoji removal for both profiles, rating-face preservation, crop alignment math, mixed-row packing, the state ring, and existing gesture/control semantics.
- TypeScript: passed.
- Vitest: 35 files, 206 tests passed.
- Production build: passed; the existing chunk-size warning remains unchanged.
- Diff whitespace check: passed; repository line-ending notices remain unchanged.
- The PNG is imported through Vite and is covered by the existing PWA PNG precache pattern.
- Local preview: `http://localhost:5173/`.

## Visual comparison

- Implementation screenshot: unavailable to this task. The selected Codex in-app browser can display the localhost build but does not expose a screenshot/DOM-inspection tool back to the agent.
- Playwright or another browser was not substituted because the Product Design workflow requires explicit approval before changing from the user's chosen browser.
- Side-by-side pixel comparison: blocked until an implementation screenshot is available from the chosen browser.

**Final result: blocked for pixel-level visual QA; functional, structural, responsive-layout, and build verification passed.**
