import './load-env';
import postgres from 'postgres';

async function testConnection() {
  const url = process.env.DATABASE_URL;
  console.log('Testing connection to URL:', url ? url.replace(/:[^:@]+@/, ':****@') : 'UNDEFINED');

  if (!url) {
    console.error('❌ ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  try {
    const isCloud = url.includes('neon.tech') || url.includes('sslmode=require');
    const sql = postgres(url, {
      ssl: isCloud ? 'require' : false,
      connect_timeout: 10,
    });

    const result = await sql`SELECT 1 as connected, version();`;
    console.log('✅ SUCCESS! Connected to PostgreSQL database:');
    console.log(result[0]);
    await sql.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ CONNECTION FAILED:');
    console.error(err.message || err);
    process.exit(1);
  }
}

testConnection();
