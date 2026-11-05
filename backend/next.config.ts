import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source; Next compiles it.
  transpilePackages: ["@siip/shared"],
  // Monorepo: trace files from the repo root so shared/ is included in the deployment.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  // Loaded from node_modules at runtime instead of being bundled (they rely on
  // Node APIs and native font handling).
  serverExternalPackages: ["@react-pdf/renderer", "cloudinary"],
};

export default nextConfig;
