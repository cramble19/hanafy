# Custom Habits

Hana and Cramble can each add their own tracking items from **Add habit** in the
bottom dock. The first choice is **Scheduled habit** or **Anytime log**. An item
belongs only to the profile where it was created: Hana earns flowers and
Cramble earns renown for scheduled goals, while anytime logs are neutral records.

## The tracking day

Today runs from **4:00 AM until 3:59 AM the following calendar day** in the
device's local time. For example, progress recorded at 1:00 AM on Friday still
belongs to Thursday. At 4:00 AM the app advances to Friday. The Today card shows
a **4 AM reset** badge as a reminder.

Existing historical date keys are left unchanged because older records do not
contain the time of day needed to move them safely. The 4:00 AM rule applies to
new tracking and future rollovers.

## Anytime logs

An anytime log has no deadline. Use it for something worth recording when it
happens, without asking the app to expect it every day or every week. Empty days
are neutral: they never become misses, break a combo, consume a skip/pass, or
change flowers, renown, and the Today score.

There are two record styles:

- **Done today / Once today** records one yes/no mark for the current tracking
  day, such as visiting the gym. Press **Undo** to remove a mistaken mark.
- **Number / Count** stores a non-negative whole-number total for the tracking
  day, such as pages, sets, or glasses. The plus and minus buttons correct the
  day's amount one step at a time. An optional unit explains the number.

Anytime logs appear in their own section below scheduled quests, so the opening
Today score remains about work that is actually due. They have a separate,
judgment-free Ledger section: once-today logs show recorded-day marks, while
count logs show amounts by day. The 7, 30, 90, and all-time views report factual
totals, active days, averages, pace, and the most recent record. Unrecorded days
are always shown as neutral.

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
separate miss. A skip or pass can make the current whole period neutral.

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

Use the `i` button on a Today card, then choose Settings. Any habit can change its
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

Each scheduled habit also has a finite quest journey. Easy daily habits usually
bloom after a 3-period combo or 5 total successes; medium and hard chapters take
longer. Period goals use shorter window-based paths. Pauses and skips are
neutral, while only a finalized miss restarts the combo. Once either path is
complete, the quest leaves Today on the next tracker day and remains in the
Ledger as a completed chapter with all history and rewards intact.

## Recovery and recent corrections

**Pause tracking** creates a neutral break for the whole profile. A reason such
as rest, sick, period, vacation, travel, a changed schedule, or something else
is saved as the selected reason label. No completions, misses, weeds, or
reminders are recorded during the break. An indefinite pause remains until the
user presses Resume.

The **Recent day** action can record or undo a scheduled habit or anytime log
during the previous three tracking days. It cannot change a future, paused,
archived, pre-creation, locked, unscheduled, or passed opportunity. These recent
days stay open rather than becoming unfinished until the correction window
closes. An empty anytime day remains neutral even after that window closes.

Hana begins with only two built-in Anytime logs:

- **Energy level** — choose a rating from 1 to 5 for the current tracker day.
- **Had a productive day** — log it once when the day felt meaningfully productive.

Neither affects flowers, streaks, or Today completion. Energy ratings are
entered from Today rather than the Recent day correction screen.

Both Hana and Cramble also have a compact **How was today?** emotion picker
below the daily quote. Heavy, Low, Okay, Good, and Bright are neutral factual
records, saved separately for each person. A choice can be changed during the
same 4 AM-to-4 AM tracker day; an empty day remains neutral.

## Reminders and export

Reminder intent is stored with the profile and is suppressed as soon as the
goal is complete, paused, or archived. The current reminder is deliberately a
browser notification while the profile is open. If its time passes, it catches
up the next time that profile is opened during the same tracking day. Reminder
times from midnight through 3:59 AM belong to the tracking day that began the
previous calendar date. Reliable closed-app delivery requires authenticated Web
Push infrastructure.

**Export data** keeps Hana and Cramble separate and offers three formats:

- **Progress report (.html)** is the recommended, beautiful Chronicle. It opens
  offline in any browser, explains the 4:00 AM tracking day, summarizes progress,
  and shows each habit's full goal-window history. Use the browser's Print action
  to save it as a PDF. Private pause reasons and notes are not printed.
- **Spreadsheet (.csv)** contains detailed habit, period, occurrence, pause, and
  correction rows plus anytime definitions, dated values, and emotion records for Excel or Google
  Sheets. User-entered text is protected against accidental spreadsheet formulas.
- **Complete backup (.json)** stores the whole profile snapshot plus the resolved
  habit definitions and format/version metadata. This is the best preservation
  format, although the app does not yet provide a one-click import screen.

Exports are created locally from the normalized profile and still work offline.
The CSV and JSON files may contain personal pause reasons or notes, so keep them
private. Postgres remains the deployed app's live saved copy.

The database does not use one shared JSON for both people. It stores one current
JSONB snapshot row for Hana and a separate current row for Cramble. Each snapshot
contains that profile's custom habits, anytime definitions and logs, settings,
lifecycle, reminders, pauses, correction audit, dated records, and rewards.
Built-in definitions originate in the app code, which is why the JSON export
also embeds the resolved catalog.
