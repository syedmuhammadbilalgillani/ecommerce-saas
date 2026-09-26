import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/index.ts',
  // Schema changes are made with SQL files in ./migrations (see src/migrate.ts); drizzle-kit is only used for studio.
  out: './drizzle-kit-out',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_saas',
  },
});
