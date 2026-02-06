import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure API routes can run server-side logic
  serverExternalPackages: ['chokidar'],
};

export default nextConfig;
