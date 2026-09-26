import postgres from 'postgres';
import 'dotenv/config';

async function reset() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }

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
