# Hanafy — Overview

## What it is

Hanafy is one installable habit app with two separate personal paths:

- **Hana's Spring Garden** turns supportive health quests into flowers, levels,
  and a growing night garden.
- **Cramble's Sunward Archive** turns healthy habits into fantasy quests,
  renown, chapters, and a changing fantasy journey in the Lantern Observatory.

Both paths use the same calm, mobile-friendly app shell, but their progress,
quest lists, saved device data, and database records stay separate.

## How it works

1. Choose Hana or Cramble on the home screen.
2. Hana can explore first or start her Health Overhaul when she is ready.
3. Cramble opens directly, then begins the First Oath if the profile is new.
4. Complete or pass the quests due today, or add a personal goal done once or
   several times in a chosen number of days or weeks.
5. Tap a custom period goal to record +1; several records can happen on the same
   day, and **Undo one** corrects a mistaken record.
6. Flexible habits earn their flower or renown reward only when the full period
   target is complete. Partial progress has no penalty, and unused days are not
   treated as individual failures.
7. Open the Garden or Observatory to see real progress reflected visually.
8. Open either profile's Ledger to review recent activity and the separate
   Emotion history graph.

## What makes it kind

- Every reward comes from completing a real habit.
- Counted period goals never subtract points for partial progress.
- Three weekly skips make difficult days easier to handle.
- Missing a day is never framed as failure; the next page simply begins.
- Hana's built-in quests unlock gradually into Available quests. Nothing is
  auto-added: she chooses when to add one, with no fixed slot limit. Scheduled
  quests leave Today after their finite chapter blooms, while history remains.
- Cramble starts with five fixed lessons. Either person can add only the personal
  habits they actually want.
- Both profiles can optionally record one neutral daily emotion without changing
  rewards or streaks. A recorded emotion appears as a small face over that
  profile's unchanged Home emblem and has its own neutral Ledger graph. Hana also
  has only the approved Energy level and Productive day Anytime logs.
- Motion is subtle and respects reduced-motion preferences.

## Saving and installation

- The same website can be installed on a phone as a PWA.
- In production, each person's progress is saved under a separate profile in
  Postgres and can appear on another device.
- Each profile also has its own local cache for weak-network or offline moments.
- Local development stays device-only and does not call the production database.

## Privacy boundary

There is no account system yet. Hana and Cramble are separated by app state and
database profile, not by authenticated user accounts.

## Not included yet

- Accounts or server-verified sign-in
- Social feeds, sharing, or leaderboards
- Reminders and notifications
