# Project Working Rules

## Standalone development and workspace integration

- This repository is Hanafy, an independent React/TypeScript application. It can
  also be checked out as `projects/hanafy` in Project World Domination.
- Use `npm ci` for setup, `npm run dev` for local UI development, and run
  `npm test`, `npm run typecheck`, and `npm run build` before publishing changes.
- Preserve existing Git history and remotes. The GitHub `origin` remains the
  existing deployment source; the additional NVIDIA GitLab remote is `nvidia`.
- NVIDIA GitLab is the primary source repository. For a release, push the same
  tested commit to `nvidia` first, then to GitHub `origin` to trigger the existing
  Vercel deployments. Verify both branch tips and deployment status; report any
  partial push or failed deployment. Never force-push to resolve divergence.
- Git stores source history, not application data backups. Do not commit database
  dumps or secrets; saved user data needs its own private backup process.
- Push child changes before publishing a parent submodule reference. Never
  force-push, reset dirty work, or import another project's source directly.
- Keep all saved logs, moods, aspirations and counters intact. Do not run database
  migrations or production mutations for documentation or workspace integration.
- Keep secrets, environment values and personal data out of commits. Use isolated
  local fixtures for browser testing and preserve Hana/Cramble scope boundaries.
- Dashboard registration only supplies launch links; it does not host this app
  or alter its existing Vercel projects, database, or runtime configuration.

## Mockup-first UI workflow

For every user-facing UI change or feature, regardless of size:

1. Create a UI mockup before editing the production UI code. The mockup may be
   a generated image, wireframe, or focused visual prototype, but it must follow
   Hanafy's existing Hana and Cramble design language.
2. Share the mockup with the user and explain the intended interaction and
   layout.
3. Wait for the user's explicit approval before implementing the UI change.
4. After approval, implement and verify the change. Do not commit or push the
   implementation until the mockup has been shared and approved.

This applies to new screens, components, layout changes, styling changes,
responsive behavior, user-facing flows, and visual states. Purely internal
changes with no user-visible effect do not require a mockup.

## Dashboard identity and shared easter egg

These are required product conventions for every Project World Domination project,
including when this repository is opened independently.

- Design and maintain a distinctive project icon for the central Command Center
  dashboard. Keep an editable vector asset in this repository and make it legible
  at small sizes. Register matching artwork and its icon key in the dashboard;
  a generic placeholder is not a completed integration.
- Keep `project.yaml` dashboard metadata current. In the parent workspace, follow
  `docs/repository-architecture.md` and update the current README/launcher catalogs
  as required; metadata alone does not yet register a project. When working
  standalone, report any parent/dashboard changes still needed and verify actual
  registration before claiming the project appears there.
- Add a shared easter egg to every user-facing project UI: a single click or tap
  on the main project icon at the top left must visibly display exactly
  **I love you 81141**. Do not require a double click, long press or secret sequence.
  Support keyboard activation with an accessible button or link. Use a small,
  readable toast or dismissible message consistent with the project's design.
- Preserve the icon's existing navigation or sidebar action, and ensure that
  action does not immediately hide the message. Do not change saved data or
  authentication state when showing the easter egg.
- Verify the icon, dashboard integration and easter egg during UI implementation
  and release checks, including touch and keyboard use. A project with no UI must
  retain this requirement for its first UI; do not invent a top-left CLI control.
  Instructions describe required behavior, not proof that it is implemented.
