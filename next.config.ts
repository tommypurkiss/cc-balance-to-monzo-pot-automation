import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable webpack caching to prevent secret bundling issues
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure server-only modules are not bundled in client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
