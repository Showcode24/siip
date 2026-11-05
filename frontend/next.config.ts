import path from "node:path";
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  transpilePackages: ["@siip/shared"],
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  // The browser only talks to this app; /api/* is proxied to the backend, so
  // auth cookies stay first-party and no CORS is needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
