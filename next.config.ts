import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'img.youtube.com', pathname: '/**' },
    ],
  },
  async redirects() {
    return [
      { source: '/dashboard/library', destination: '/commands', permanent: true },
      { source: '/dashboard/library/', destination: '/commands', permanent: true },
      { source: '/dashboard/devices', destination: '/devices', permanent: true },
      { source: '/dashboard/devices/', destination: '/devices', permanent: true },
      { source: '/dashboard/runs', destination: '/runs', permanent: true },
      { source: '/dashboard/runs/:path*', destination: '/runs/:path*', permanent: true },
    ];
  },
};
export default config;
