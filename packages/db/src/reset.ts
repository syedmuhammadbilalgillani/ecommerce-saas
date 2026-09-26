import postgres from 'postgres';
import 'dotenv/config';

async function reset() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }

  // This drops every table. Refuse unless explicitly confirmed, and never in production.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to reset a database while NODE_ENV=production.');
    process.exit(1);
  }
  const host = new URL(url).host;
  if (!process.argv.includes('--confirm')) {
    console.error(`This will DELETE ALL DATA in ${host}.`);
    console.error('Re-run with --confirm to proceed:  pnpm db:reset --confirm');
    process.exit(1);
  }
  console.log(`Resetting database on ${host}...`);

  const isCloud = url.includes('neon.tech') || url.includes('sslmode=require');
  const sql = postgres(url, {
    ssl: isCloud ? 'require' : false,
    connect_timeout: 10,
  });

  console.log('Clearing old conflicting tables and constraints from database...');
  await sql`DROP SCHEMA public CASCADE;`;
  await sql`CREATE SCHEMA public;`;
  await sql`GRANT ALL ON SCHEMA public TO public;`;
  console.log('✅ Clean reset complete! Database is now fresh. Now run: pnpm db:push');
  await sql.end();
  process.exit(0);
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
