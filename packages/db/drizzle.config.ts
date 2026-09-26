import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_saas',
  },
});
