import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse reads a test PDF at module init time — must stay as external CJS
  serverExternalPackages: ["pdf-parse"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.telegram.org https://enabled-joey-40319.upstash.io",
              "media-src 'self' blob:",
              "worker-src blob:",
            ].join("; ")
          }
        ]
      }
    ];
  }
};

export default nextConfig;
