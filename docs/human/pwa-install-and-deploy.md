# Install and Deploy

Hanafy is now set up as an installable web app.

## What "installable" means

The app can be opened in a phone browser and added to the home screen like a
normal app. It has:

- an app name: **Hanafy - Spring Garden**
- app icons
- a mobile theme color
- standalone app mode
- offline app-shell caching

After the database is connected on Vercel, Hana's progress is saved in Postgres
as the main copy. The phone keeps a small local cache only as a fallback.

## Best hosting choice

Use **Vercel** first. It is free for this kind of personal project, simple for a
Vite app, and gives the HTTPS URL needed for phone installation.

## Database setup

Vercel hosts the backend endpoint, but the database should be a connected
Postgres database. The simplest choice is Neon Postgres through Vercel's Storage
or Marketplace flow.

Steps:

1. Open the Hanafy project in Vercel.
2. Add a Postgres database, preferably Neon Postgres.
3. Connect it to the Hanafy project.
4. Make sure Vercel has `DATABASE_URL` or `POSTGRES_URL` in Environment
   Variables.
5. Redeploy the project.
6. Open the deployed app and complete/skip one quest. The database tables are
   created automatically on the first successful sync.

## Phone install

After deployment:

- Android Chrome: open the Vercel URL, then tap **Install app** or **Add to Home
  screen**.
- iPhone Safari: open the Vercel URL, tap **Share**, then **Add to Home Screen**.

If the app is opened from the home screen, it should feel more like a small phone
app than a normal browser tab.
