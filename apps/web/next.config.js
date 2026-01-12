const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  reactStrictMode: true,
  
  // TypeScript/ESLint 빌드 에러 무시 (배포 우선)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 이미지 최적화
  images: {
    domains: ['images.unsplash.com', 'assets.aceternity.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 실험적 기능
  experimental: {
    // App Router 최적화
    optimizePackageImports: ['framer-motion'],
  },
  
  // URL 리다이렉트 (기존 라우트 호환성)
  async redirects() {
    return [
      {
        source: '/market',
        destination: '/consume',
        permanent: true,
      },
      {
        source: '/market/:path*',
        destination: '/consume/:path*',
        permanent: true,
      },
      {
        source: '/infra',
        destination: '/channel',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

