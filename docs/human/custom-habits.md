# Custom Habits

Hana and Cramble can each add their own habits from the large **Add habit**
button at the bottom of the tracker. A habit belongs only to the profile where
it was created: Hana earns flowers, while Cramble earns renown.

## The tracking day

Today runs from **4:00 AM until 3:59 AM the following calendar day** in the
device's local time. For example, progress recorded at 1:00 AM on Friday still
belongs to Thursday. At 4:00 AM the app advances to Friday. The Today card shows
a **4 AM reset** badge as a reminder.

Existing historical date keys are left unchanged because older records do not
contain the time of day needed to move them safely. The 4:00 AM rule applies to
new tracking and future rollovers.

## Creating a habit

The form asks for:

- a short habit name;
- a description that makes one completion clear;
- one of two goal patterns;
- a Daily, Weekly, or Custom schedule; and
- an easy, medium, or hard difficulty.
- an optional routine cue, such as **After breakfast**; and
- an optional in-app reminder time.

The two goal patterns are:

- **Once per period** — useful for once daily, once weekly, once every 3 days,
  or another personal rhythm.
- **Several times** — useful for twice daily, 3 times in 10 days, or another
  repetition target.

Daily begins a fresh goal each day. Weekly follows the calendar week and resets
on Sunday. Custom lets you choose 1–365 days; those windows begin when the habit
is created and continue back-to-back. Custom 7 days is therefore a rolling
personal week, while Weekly always means Sunday through Saturday.

## Recording progress

Tap the habit to record **+1**. Several records can be made on the same day, so
a goal such as brushing twice daily works naturally. The card shows progress
such as **1 of 2 today**, **2 of 3 this week**, or **1 of 3 in 10 days**.

If a record was accidental, **Undo one** removes one record made today. Once the
whole target is complete, the habit rests until its next period. It stays visible
on a day that has records so the latest action can still be corrected.

## Rewards without punishment

Easy, medium, and hard period goals are worth 1, 2, and 3 flowers or renown.
That reward arrives once, only after the entire target is complete. For example,
the first tooth-brushing record in a twice-daily goal is useful progress, but the
reward is earned after the second record.

Partial progress has no penalty and creates no reward debt. Flexible goals are
judged once for the whole period, so every unused day is not turned into a
separate miss. These goals also do not use Hana's skips or Cramble's passes.

## Saving and separation

Custom habits are available after that profile has started. Hana's unsaved
Explore preview cannot create one.

The habit, each day's record count, period progress, and rewards are saved
separately for the person who created it. A custom Hana habit never appears in
Cramble's Archive, and a Cramble habit never changes Hana's Garden. Resetting
progress keeps the custom habit itself but clears its recorded progress so it can
begin fresh.

Habits created with the older daily, weekly, or 10-day form continue to work with
their original saved history and rewards.

## Editing and lifecycle

Use the settings button on a habit card to manage it. Any habit can change its
name, completion description, cue, and reminder. User-added habits can also
change frequency, target, and difficulty until they have records or an older due
day. Built-in scoring rules are fixed. Once history exists, scoring rules lock so
an edit cannot rewrite old periods or rewards; archive the old rhythm and add a
new habit instead.

Any habit can be paused or archived. A pause is temporary and records a neutral
dated interval. Archive removes the habit from Today and suppresses its reminder
while keeping the reminder choice, Ledger history, and already-earned rewards.
Archived habits appear in the Ledger and can be restored. Any habit can be
deleted permanently; a typed-name confirmation removes its records, settings,
and rewards. Built-in habits receive a database tombstone so they cannot
reappear after reload.

## Recovery and recent corrections

**Pause tracking** creates a neutral break for the whole profile. A reason such
as rest, sick, period, vacation, travel, a changed schedule, or something else
is saved as the selected reason label. No completions, misses, weeds, or
reminders are recorded during the break. An indefinite pause remains until the
user presses Resume.

The **Recent day** action can record or undo something during the previous
three tracking days. It cannot change a future, paused, archived,
pre-creation, locked, unscheduled, or passed opportunity. These recent days stay
open rather than becoming unfinished until the correction window closes.

## Reminders and export

Reminder intent is stored with the profile and is suppressed as soon as the
goal is complete, paused, or archived. The current reminder is deliberately a
browser notification while the profile is open. If its time passes, it catches
up the next time that profile is opened during the same tracking day. Reminder
times from midnight through 3:59 AM belong to the tracking day that began the
previous calendar date. Reliable closed-app delivery requires authenticated Web
Push infrastructure.

**Export CSV** downloads a profile-isolated report containing habit definitions,
period outcomes, exact occurrence dates, lifecycle state, reminders, profile and
habit pause intervals, and one audit row for every backfill add or undo—even
when the final count returns to zero. Each row identifies the 04:00 local
tracking-day boundary. It works from the local
normalized snapshot even when offline. CSV is a portable report, while Postgres
remains the deployed app's live saved copy.
