import type { NextConfig } from "next";

// Browser requests to /api/* are proxied to the PHP + MySQL backend.
// The fallback keeps the production API URL configured even when the
// Vercel environment variable has not yet been added.
const phpApiBase = (
  process.env.TELEAD_PHP_API_URL || "https://teleads.sammiehosty.com/api"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${phpApiBase}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
