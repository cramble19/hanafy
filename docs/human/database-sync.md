# Database Sync

Hanafy now keeps working locally first, but it can also save Hana's progress to
a cloud database after deployment.

## What gets saved

The app saves:

- which daily quests were shown for a day
- which quests were completed
- which quests were skipped
- long-term quest windows and deadlines
- Evening Weed checks
- Hana's current flower balance

This makes future statistics possible, such as weekly graphs, completion rate,
skip patterns, flower history, and which habits are becoming consistent.

## What stays simple

There is still no login. For now, the only saved profile is **Hana**. Cramble can
be added later with the same structure.

The app still saves locally on the phone first, so it remains usable even if the
internet is unavailable. When the app is online, it syncs the latest progress to
the database.

## When sync happens

The deployed app syncs Hana's local progress to the database:

- shortly after a quest, skip, or weed changes
- when the app comes back online
- when the app is opened or resumed
- when the **Sync** button is tapped on Hana's page

For now, the phone's local progress is the source of truth. If the phone and
database disagree, tapping **Sync** uploads the phone's current progress to the
database. The database is mainly the history/statistics copy.

## Where it runs

Vercel hosts the small backend endpoint. The database is a Postgres database
connected to the Vercel project, such as Neon Postgres.
