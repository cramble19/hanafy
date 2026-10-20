# Hanafy

## Purpose

A personal habit-tracking app for Hana and Cramble, with daily records, mood
history, life aspirations and lifetime counters.

## Status

Active. The existing deployments remain unchanged:

- [Hanafy](https://hanafy-green.vercel.app) — combined entry point.
- [Cramble](https://hanafy-cramble.vercel.app) — direct Cramble entry point.

## Features

- Daily habits with once-per-day, count and rating records.
- Ledger and Rhythm history, categories, and mood charts.
- Someday aspirations and editable lifetime counters.
- Separate Hana and Cramble experiences and installable PWA support.

## Quick start

Run from this repository with Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Normal development uses separate device-local state and disables cloud sync.
Do not use production-data preview or database migration tools for routine UI work.
See `.env.example` for optional configuration names; no database is required for
the normal local UI. The Vite development URL is not a public deployment.

## Development

Follow `AGENTS.md`, including mockup approval before user-facing changes.
Keep Hana and Cramble scope explicit. Use the existing package lockfile.

The original `origin` remains GitHub: `https://github.com/cramble19/hanafy.git`.
The additional `nvidia` remote is the independent workspace repository:
`ssh://git@gitlab-master.nvidia.com:12051/adityakumarj/hanafy.git`.
Publish child commits before updating the parent workspace's submodule pin.
GitLab pushes do not replace the existing GitHub-to-Vercel deployment workflow.

## Testing

```sh
npm test
npm run typecheck
npm run build
```

Type checking is the declared static check; no separate formatter is configured.
Browser tests must use isolated local fixtures and block production API writes.

## Architecture

- `src/`: React/TypeScript UI, domain logic, profile experiences and local state.
- `api/`: Vercel serverless synchronization API backed by PostgreSQL/Neon.
- `scripts/`: explicit database migration and PWA asset tooling.
- Vite builds the frontend and PWA assets. The Cramble deployment can forward
  its API to the existing combined deployment through server-only configuration.

Project World Domination references this repository at `projects/hanafy`;
registration is a launch link, not a hosting or data migration operation.

## Security and privacy

Never commit environment files, credentials, database exports, or local browser
state. Keep database connection strings server-side in the existing deployment
secret store; never prefix them with `VITE_`. Saved logs and moods are personal
data. Do not run migrations, reset state, or change cloud sync to integrate the
workspace. Existing access controls and deployment settings are not strengthened
or changed by dashboard registration.

## Roadmap

- Continue approved usability and visual consistency improvements.
- Preserve historical records while evolving tracking and reporting features.
- Keep workspace metadata and launch links aligned with deployed releases.
