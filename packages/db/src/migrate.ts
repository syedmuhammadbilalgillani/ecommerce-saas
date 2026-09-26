/**
 * Applies pending SQL migrations from packages/db/migrations in filename order.
 *
 *   pnpm db:migrate            apply everything not yet applied
 *   pnpm db:migrate --status   list applied / pending without changing anything
 *
 * Each file runs in its own transaction and is recorded in "schema_migrations", so a failed file
 * leaves the database exactly as it was before that file. A Postgres advisory lock stops two
 * deploys from migrating at the same time. Applied files must never be edited — add a new file.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');
const LOCK_ID = 727_101; // arbitrary constant shared by every migrate run

function checksum(content: string): string {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  const statusOnly = process.argv.includes('--status');

  const isCloud = url.includes('neon.tech') || url.includes('sslmode=require');
  const sql = postgres(url, { ssl: isCloud ? 'require' : false, max: 1, onnotice: () => {} });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "schema_migrations" (
        "id" text PRIMARY KEY NOT NULL,
        "checksum" text NOT NULL,
        "applied_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    const applied = new Map((await sql`SELECT id, checksum FROM schema_migrations`).map((r) => [r.id as string, r.checksum as string]));

    // An applied migration that was edited afterwards means environments have silently diverged.
    for (const file of files) {
      const recorded = applied.get(file);
      if (recorded && recorded !== checksum(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) {
        throw new Error(`${file} was modified after it was applied. Revert the edit and add a new migration instead.`);
      }
    }

    const pending = files.filter((f) => !applied.has(f));
    if (statusOnly) {
      for (const f of files) console.log(`${applied.has(f) ? 'applied ' : 'PENDING '} ${f}`);
      return;
    }
    if (pending.length === 0) {
      console.log('✅ Database is up to date.');
      return;
    }

    await sql`SELECT pg_advisory_lock(${LOCK_ID})`;
    try {
      for (const file of pending) {
        const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        process.stdout.write(`Applying ${file} ... `);
        await sql.begin(async (tx) => {
          await tx.unsafe(content);
          await tx`INSERT INTO schema_migrations (id, checksum) VALUES (${file}, ${checksum(content)})`;
        });
        console.log('done');
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(${LOCK_ID})`;
    }
    console.log(`✅ Applied ${pending.length} migration(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`❌ Migration failed: ${err.message}`);
  process.exit(1);
});
