import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse reads a test PDF at module init time — must stay as external CJS
  serverExternalPackages: ["pdf-parse"]
};

export default nextConfig;
