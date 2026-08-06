# Project Documentation

Every significant Hanafy feature has two synchronized documentation tracks:

- `human/` explains what the feature does and why it matters in plain language.
- `ai/` records the implementation, data model, invariants, trade-offs, and files.

When behavior changes, update both tracks in the same change and keep them aligned
with the code. `.cursor/rules/documentation.mdc` enforces this convention.

## Current documents

| Topic | Human | AI |
|---|---|---|
| Project overview / architecture | [human/overview.md](human/overview.md) | [ai/architecture.md](ai/architecture.md) |
| Design system | [human/design.md](human/design.md) | [ai/design-system.md](ai/design-system.md) |
| Hana flower game | [human/hana-game.md](human/hana-game.md) | [ai/hana-game.md](ai/hana-game.md) |
| Cramble fantasy habit game | [human/cramble-game.md](human/cramble-game.md) | [ai/cramble-game.md](ai/cramble-game.md) |
| Custom habits | [human/custom-habits.md](human/custom-habits.md) | [ai/custom-habits.md](ai/custom-habits.md) |
| Profile-aware database sync | [human/database-sync.md](human/database-sync.md) | [ai/database-sync.md](ai/database-sync.md) |
| Install and deploy | [human/pwa-install-and-deploy.md](human/pwa-install-and-deploy.md) | [ai/pwa-install-and-deploy.md](ai/pwa-install-and-deploy.md) |

Approved legacy visual references live in
[design/references/](design/references/). The live tokens and scoped variants in
`src/styles/globals.css` are authoritative when a newer implemented profile is
not represented in those images.
