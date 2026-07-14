# Hana's Flower Game

Hana's tracker now works like a small flower-collecting game.

The game starts only after Hana chooses her own first day. If she is not ready to
commit, she can explore the app without saving progress to the database.

## How it works

- Every quest gives flowers when Hana completes it.
- **Easy** quests give **1 flower**.
- **Medium** quests give **2 flowers**.
- **Hard** quests give **3 flowers**.
- Flowers fill the level bar and are planted in Hana's separate garden page.

## Arc 1: Spring

The first season is **Arc 1: Spring**. It is intentionally gentle and easier than
future seasons because the goal is to make the game feel rewarding before asking
for harder consistency.

Spring is complete when Hana reaches:

- **Level 5**
- **35 net flowers**
- **100% Spring garden fullness**

After Spring is complete, the app teases the next season: **Summer**, focused on
consistency and tougher choices.

There are tiny spring/music easter eggs inspired by the feeling of *Your Lie in
April*: soft duet imagery, piano/violin notes, canelé, sunlight, blossoms, and
the daily memory quest **Remember Cramble**.

The top of Hana's page also shows one rotating Spring note each day. Some are
classic public-domain spring quotes, some are original notes inspired by the
spring/music mood of *Your Lie in April*, and some are exact anime quotes
provided by the user.

## Garden page

The quest page only shows Hana's flower balance and progress. The actual garden
is a dedicated page with a night sky, a softly drifting moon, twinkling stars,
occasional comets, hills, and planted flowers.

Hana's page also has a small night-garden preview and soft bottom buttons for
the Garden and Stats, so progress feels close without crowding the quest list.

At the center of the garden, a quiet couple silhouette sits together watching
the stars.

Every net flower in Hana's balance plants a real illustrated flower in the garden
(not an emoji). Evening Weeds can wilt flowers from the balance, so the visible
garden reflects the current net flower count.

As Spring gets closer to full, the Garden page gets warmer, richer, and glowier.

## Evening Weeds

At the end of the day, Hana can gently check a few "weeds" — small patterns that
may have pulled the day away from feeling healthy.

This is not meant to shame her. It is just honest reflection.

- Every checked weed is recorded for that day.
- Every **3 weeds** wilt **1 flower** from the garden balance.
- Unchecking a weed restores the balance if the wilt threshold changes.

Current weeds:

- Scroll Fog
- Midnight Snack Vine
- Sweet Sip Cloud
- Hydration Drought
- Phone-in-Bed Ivy

## Levels

Each level needs a certain number of flowers. As Hana collects more flowers, she
levels up and sees more progress in the garden.

## Tasks

The tasks are stored in one editable file: `src/data/hanaTasks.json`.

The app does **not** show every task at once. That would feel like homework.
Instead, Hana starts with a small active set:

- **2 daily quests**
- **1 long-term quest**

The special Spring memory quest **Remember Cramble** appears daily as a tiny
bonus quest and does not replace the core water/sun/iron habit slots.

As Hana levels up, a few more quests unlock slowly.

Daily task choices are planned for the day, so checking one task will not make a
different task suddenly swap out.

Daily and long-term quests work differently:

- **Daily quests** reset every new day.
- **Long-term quests** have their own personal deadline. For example, Badminton
  can be completed within 4 days, while harder willpower quests like improving
  sleep get around 10 days.
- Once a long-term quest is completed, it stays complete for that challenge
  window. After the deadline passes, a fresh window starts.

## Weekly skips

Hana gets **3 skips each week**. They reset every Sunday.

- A skipped quest counts as handled for that day or long-term window.
- A skipped quest gives **0 flowers**.
- Skips are meant for real-life days when energy, plans, or sleep do not cooperate.
- Skips can be undone if tapped by mistake.

## Why the tasks are gentle

The app is based on Hana's reports showing low iron / iron saturation and
sub-optimal vitamin D, plus signs that make hydration worth encouraging. It does
not diagnose or prescribe treatment. It simply nudges small daily actions:

- drink water
- get relaxed daylight
- eat iron/protein-friendly snacks
- pair iron foods with vitamin-C foods
- keep tea/coffee away from iron-focused meals
- wind down more gently at night
- add colorful food, daylight photos, gentle stretching, energy checks, and
  small Cramble connection moments
- add gentle hair-care rituals like loose/satin sleep, hair-wash hydration,
  weekly oiling, and protein support

The early levels stay easy on purpose. Hard lifestyle changes usually fail. As
Hana collects flowers and levels up, a few extra supportive quests unlock slowly.

## Dev testing

In local development, the Hana page has two temporary testing buttons:

- **Next day:** moves the tracker forward one day so we can test daily resets and
  long-term deadlines.
- **Reset:** clears Hana's flowers and checked quests.

These only appear when running locally with the dev server. They are hidden from
the deployed production app.

## Stats page

The Stats page is a gentle garden journal. It shows:

- overall quest rhythm
- this week's tiny day-by-day petals
- a Quests page with every quest listed row by row
- a quest detail page with done/skipped totals and a colored calendar trail
- a Weeds page with every Evening Weed listed row by row
- a weed detail page with total checks and a colored calendar trail

The language avoids guilt. Missed or skipped quests are treated as useful signals,
not failure.
