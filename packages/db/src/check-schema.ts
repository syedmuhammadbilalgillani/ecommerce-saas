/**
 * Fails (exit 1) if the database and the Drizzle schema in index.ts disagree, or if any
 * migration is still pending. Run it in CI and before deploying.
 *
 *   pnpm db:check
 *
 * The Drizzle schema (what the API code expects) and the SQL migrations (what the database
 * actually has) are maintained by hand, so this catches the two drifting apart.
 */
import './load-env';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from './index.ts';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  const isCloud = url.includes('neon.tech') || url.includes('sslmode=require');
  const sql = postgres(url, { ssl: isCloud ? 'require' : false, max: 1 });
  const problems: string[] = [];

  try {
    const rows = await sql`
      SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'`;
    const dbColumns = new Map<string, Map<string, boolean>>();
    for (const r of rows) {
      if (!dbColumns.has(r.table_name)) dbColumns.set(r.table_name, new Map());
      dbColumns.get(r.table_name)!.set(r.column_name, r.is_nullable === 'YES');
    }

    for (const value of Object.values(schema)) {
      if (!(value instanceof PgTable)) continue;
      const table = getTableConfig(value);
      const cols = dbColumns.get(table.name);
      if (!cols) {
        problems.push(`table "${table.name}" is in the Drizzle schema but not in the database`);
        continue;
      }
      for (const col of table.columns) {
        if (!cols.has(col.name)) {
          problems.push(`column "${table.name}.${col.name}" is in the Drizzle schema but not in the database`);
        } else if (col.notNull && cols.get(col.name)) {
          problems.push(`column "${table.name}.${col.name}" is NOT NULL in Drizzle but nullable in the database`);
        }
      }
      for (const [name] of cols) {
        if (!table.columns.some((c) => c.name === name)) {
          problems.push(`column "${table.name}.${name}" exists in the database but not in the Drizzle schema`);
        }
      }
    }

    const files = readdirSync(join(import.meta.dirname, '..', 'migrations')).filter((f) => /^\d{4}_.+\.sql$/.test(f));
    const hasTable = (await sql`SELECT to_regclass('public.schema_migrations') AS t`)[0].t;
    const applied = new Set(hasTable ? (await sql`SELECT id FROM schema_migrations`).map((r) => r.id as string) : []);
    for (const f of files) if (!applied.has(f)) problems.push(`migration ${f} has not been applied (run pnpm db:migrate)`);
  } finally {
    await sql.end();
  }

  if (problems.length > 0) {
    console.error(`❌ Schema check failed:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log('✅ Database matches the Drizzle schema and all migrations are applied.');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
