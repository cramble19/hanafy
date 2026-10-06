import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL or POSTGRES_URL before running migrations.')
}

const sql = neon(databaseUrl)
for (const file of ['001_profile_sync.sql', '002_cramble_domains.sql']) {
  const migration = await readFile(fileURLToPath(new URL(`../database/migrations/${file}`, import.meta.url)), 'utf8')
  const statements = migration.split('-- migrate:split').map(statement => statement.trim()).filter(Boolean)
  await sql.transaction(statements.map(statement => sql.query(statement)))
  console.log(`Applied ${file}.`)
}
