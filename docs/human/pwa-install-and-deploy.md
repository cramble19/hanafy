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

The data still stays only on the device because there is no backend yet.

## Best hosting choice

Use **Vercel** first. It is free for this kind of personal project, simple for a
Vite app, and gives the HTTPS URL needed for phone installation.

## Phone install

After deployment:

- Android Chrome: open the Vercel URL, then tap **Install app** or **Add to Home
  screen**.
- iPhone Safari: open the Vercel URL, tap **Share**, then **Add to Home Screen**.

If the app is opened from the home screen, it should feel more like a small phone
app than a normal browser tab.
