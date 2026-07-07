# Project Documentation

This project keeps **two parallel sets of documentation**. For every feature or
significant decision, we maintain one document in each track so that both people
and the AI agent always have the right level of detail.

## Tracks

### `human/` — for people

- Plain language, non-technical.
- Explains *what* something is and *why* it matters to a user.
- No code and no jargon. A non-developer should be able to read it.

### `ai/` — for the AI agent (and developers)

- Technical and precise.
- Explains *how* it works: stack, data models, file locations, logic, trade-offs.
- Contains everything the AI needs to make correct, safe changes.

## The convention

When we implement or change a feature `X`:

1. Update/create `human/X.md` — concise and easy.
2. Update/create `ai/X.md` — technical and complete.
3. Keep both in sync with the actual code.

This convention is enforced by the Cursor rule `.cursor/rules/documentation.mdc`.

## Current documents

| Topic | Human | AI |
|-------|-------|----|
| Project overview / architecture | [human/overview.md](human/overview.md) | [ai/architecture.md](ai/architecture.md) |
| Design system (look and feel) | [human/design.md](human/design.md) | [ai/design-system.md](ai/design-system.md) |
| Hana flower game | [human/hana-game.md](human/hana-game.md) | [ai/hana-game.md](ai/hana-game.md) |
| Install and deploy | [human/pwa-install-and-deploy.md](human/pwa-install-and-deploy.md) | [ai/pwa-install-and-deploy.md](ai/pwa-install-and-deploy.md) |

Approved visual mockups (the visual source of truth) live in
[design/references/](design/references/).
