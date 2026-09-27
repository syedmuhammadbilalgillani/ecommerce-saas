import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Automatically load the single root .env located at monorepo root
const rootEnv = resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
// Fallback to local .env if present
dotenv.config();
