import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Webpack config for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure firebase-admin is never bundled in client
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
      config.externals.push('firebase-admin/app');
      config.externals.push('firebase-admin/firestore');
      config.externals.push('firebase-admin/auth');

      // Additional fallbacks to prevent Node.js modules in client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        path: false,
        os: false,
        child_process: false,
      };
    }
    return config;
  },
  // Turbopack config (empty means use defaults, but acknowledge Turbopack)
  turbopack: {},
};

export default nextConfig;
