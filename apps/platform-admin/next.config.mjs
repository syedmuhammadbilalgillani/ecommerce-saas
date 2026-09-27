import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load single root .env from monorepo root without external package dependencies
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_STORE_ID: process.env.NEXT_PUBLIC_STORE_ID || 'store_default',
    NEXT_PUBLIC_STOREFRONT_URL: process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000',
    NEXT_PUBLIC_MERCHANT_ADMIN_URL: process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001',
    NEXT_PUBLIC_PLATFORM_ADMIN_URL: process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3002',
  },
  // The browser talks to the API through this same origin (/api/*), so the API's
  // session cookie is stored for this app's own host and is visible to proxy.ts.
  async rewrites() {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '';
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
