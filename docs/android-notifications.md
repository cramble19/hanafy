# Cramble Android notifications

Settings → Notifications enables this device after Android browser permission.
Preferences are per browser origin/device, not part of the game snapshot.
Use one installed app origin to avoid subscribing twice on the same phone.

Defaults (Asia/Kolkata): quote at 08:00, tracking at 22:00, 00:00, 02:00.
All four hours are editable. The three tracking hours must be distinct. An
overlapping quote/reminder becomes one combined notification. There is no
snooze, completion button, or suppression based on habit completion.

Hobby scheduling uses 24 once-daily jobs, each at UTC :30 for its IST hour.
Delivery may be up to 59 minutes late. Dispatch rejects jobs outside their
assigned hour and uses an atomic per-device slot claim to suppress duplicates.
Push messages expire at the hour boundary, so offline devices do not receive a
backlog. Ambiguous send failures keep their claim (at-most-once send attempts).
Expired subscriptions are disabled. OS permission/network restrictions can
still prevent delivery. A real Android phone test is needed after enabling.

The database-owning Hanafy deployment needs production-only secrets:
WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, CRON_SECRET. Never rotate the VAPID
pair casually: existing devices subscribe using that public key. CRON_SECRET
is automatically sent by Vercel as Bearer authorization. The Cramble deployment
forwards preferences to Hanafy via HANAFY_API_UPSTREAM and does not dispatch.
Apply only database/migrations/003_cramble_push.sql to add notification storage
to an existing deployment; it never rewrites saved state. Do not run prior
migrations unnecessarily.

Device management uses a random 256-bit browser capability token; only its
SHA-256 digest is stored server-side. Write origins and push endpoint hosts are
allowlisted. Subscription data must not be logged or committed. The dispatch
endpoint requires CRON_SECRET and only reads the Cramble composed snapshot.
Profile pauses use the existing 4 AM logical-day boundary. Morning quote
selection is shared with Today. Opening a notification navigates to Today
without changing any records.
