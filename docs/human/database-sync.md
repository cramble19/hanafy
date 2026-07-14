# Database Sync

Hanafy now uses the cloud database as the main saved copy of Hana's progress.
This means Hana can open the app from another phone or laptop and still see the
same garden.

The database only starts after Hana chooses her own first day. Before that, the
app may be explored, but preview progress is not saved to the database.

## What gets saved

The app saves:

- Hana's chosen start date
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

The app still keeps a small saved cache on the device. That cache is only for
offline fallback. When the app is online, the database is the source of truth.

## When sync happens

The deployed app talks to the database:

- when Hana chooses her first day, clearing old preview/legacy data first
- when Hana opens or resumes the app
- before showing Hana's current saved garden on a new device
- when a quest, skip, or weed changes
- when the app comes back online
- when the **Refresh** button is tapped on Hana's page

Quest, skip, and weed taps should still feel instant. The app updates the screen
right away, then quietly saves the newest version to the database in the
background.

If the phone and database disagree while online, the database wins. The local
cache is updated from the database.

## Where it runs

Vercel hosts the small backend endpoint. The database is a Postgres database
connected to the Vercel project, such as Neon Postgres.
