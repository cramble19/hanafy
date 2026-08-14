# Database migrations

The sync API assumes its tables already exist so opening the app never performs
schema setup work.

Set `DATABASE_URL` or `POSTGRES_URL` in a trusted shell, then run:

```powershell
npm run db:migrate
```

Migrations are idempotent. Run them before deploying an API version that depends
on a new schema. Never put a production connection string in the repository or
client bundle.
