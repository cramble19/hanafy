import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL or POSTGRES_URL before running migrations.')
}

const migrationUrl = new URL(
  '../database/migrations/001_profile_sync.sql',
  import.meta.url,
)
const migration = await readFile(fileURLToPath(migrationUrl), 'utf8')
const statements = migration
  .split('-- migrate:split')
  .map((statement) => statement.trim())
  .filter(Boolean)
const sql = neon(databaseUrl)

for (const statement of statements) {
  await sql.query(statement)
}

console.log(`Applied ${statements.length} idempotent profile-sync migrations.`)
