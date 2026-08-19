# Design QA — Anytime Log tap and hold

## Source visual

- Approved reference: `C:\Users\adityakumarj\.codex\generated_images\01a018c5-fa64-78e0-ad11-84e9ddf7d28f\exec-94990f44-6533-4636-85c0-3e3a646ddf9b.png`
- Target states: Hana Today's activity log and Cramble Today's field log.

## Implemented mapping

- Binary check logs use the full card as a single accessible action.
- Tap/click records an unlogged item and undoes a recorded item; the visible `+` action is removed.
- A 550 ms hold opens that item's existing settings screen without also changing its recorded state.
- Pointer movement, cancellation, and lost capture cancel the hold so normal scrolling remains safe.
- `Shift+F10`, the Context Menu key, and right-click provide equivalent settings access for keyboard and pointer users.
- The exact guidance `Tap a log to record · Hold to edit` appears under both profile headings.
- Count and rating logs keep their explicit controls, filters, persistence callbacks, and focus hand-off behavior.
- Binary cards do not show a separate settings badge; their recorded state remains visible through the established settled-card treatment.

## Verification

- Vitest: 34 files, 202 tests passed.
- TypeScript and production build: passed.
- Diff whitespace check: passed; repository line-ending warnings remain unchanged.
- Focused coverage verifies both profile labels, full-card button semantics, recorded/unrecorded states, the 550 ms threshold, and keyboard settings shortcuts.
- Local preview: responding at `http://localhost:5173/`.

## Visual comparison

- Implementation screenshot: unavailable in this task context. The chosen Codex in-app browser displays the running preview but does not expose a screenshot or inspection result to this task. Playwright was not used because switching from the chosen browser requires explicit permission.
- Side-by-side reference comparison: blocked by the missing implementation screenshot.

**Final result: blocked for pixel-level visual QA; functional, structural, and build verification passed.**
