import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle html2canvas properly in webpack
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    
    return config;
  },
  // Remove esmExternals as it's not supported in Turbopack
  // Instead, we'll handle html2canvas through our loader utility
};

export default nextConfig;
