import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript is checked by the build script before Next runs.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
