import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  output: "standalone", turbopack: { root: path.resolve(__dirname, "../..") }, outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@wholesale/shared"],
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:3001"}/:path*` }]; },
};
export default nextConfig;
