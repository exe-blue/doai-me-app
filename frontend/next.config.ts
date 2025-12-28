import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: Remove this after fixing all TypeScript errors (PR/ticket pending)
    // Added: 2025-12-28 - Run `npx tsc --noEmit` to see current errors
    ignoreBuildErrors: true,
  },
  // Disable static export for auth-protected routes
  output: undefined,
  async redirects() {
    return [
      {
        source: '/devices',
        destination: '/dashboard/devices',
        permanent: true,
      },
      {
        source: '/watch',
        destination: '/dashboard/do',
        permanent: true,
      },
      {
        source: '/watch/:path*',
        destination: '/dashboard/do/:path*',
        permanent: true,
      },
      {
        source: '/issues',
        destination: '/dashboard/logs',
        permanent: true,
      },
      {
        source: '/activities',
        destination: '/dashboard/activities',
        permanent: true,
      },
      {
        source: '/boards',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/logs',
        destination: '/dashboard/logs',
        permanent: true,
      },
      {
        source: '/channels',
        destination: '/dashboard/channels',
        permanent: true,
      },
      {
        source: '/ranking',
        destination: '/dashboard/ranking',
        permanent: true,
      },
      {
        source: '/battle',
        destination: '/dashboard/battle',
        permanent: true,
      },
      {
        source: '/ideas',
        destination: '/dashboard/ideas',
        permanent: true,
      },
      {
        source: '/trends',
        destination: '/dashboard/trends',
        permanent: true,
      },
      {
        source: '/notifications',
        destination: '/dashboard/notifications',
        permanent: true,
      },
      {
        source: '/settings',
        destination: '/dashboard/settings',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;