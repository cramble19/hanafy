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
