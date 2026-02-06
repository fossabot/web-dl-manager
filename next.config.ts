import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 禁用 Lint During Build, CI/Pre-push hook already handles it
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
