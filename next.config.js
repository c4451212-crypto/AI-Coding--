/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  output: 'standalone',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
