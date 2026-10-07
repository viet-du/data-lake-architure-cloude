import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@duckdb/node-api', 'mongoose'],
  poweredByHeader: false,
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      '@valkey/valkey-glide',
    ];
    return config;
  },
};

export default nextConfig;