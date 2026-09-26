/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui'],
  reactStrictMode: true,
  // The browser talks to the API through this same origin (/api/*), so the API's
  // session cookie is stored for this app's own host and is visible to proxy.ts.
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:4000';
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
