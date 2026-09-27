import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load single root .env
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

export default defineConfig({
  schema: './src/index.ts',
  // Schema changes are made with SQL files in ./migrations (see src/migrate.ts); drizzle-kit is only used for studio.
  out: './drizzle-kit-out',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
