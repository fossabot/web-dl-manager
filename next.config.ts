import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'osx-temperature-sensor': 'commonjs osx-temperature-sensor',
        'macos-temperature-sensor': 'commonjs macos-temperature-sensor',
        'windows-release': 'commonjs windows-release',
      });
    }
    return config;
  },
  experimental: {
    // Other experimental options
  },
};

export default withPWA(nextConfig);
