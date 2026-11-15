import type { NextConfig } from "next";

// Forward browser API requests to the PHP + MySQL backend.
// Override this in Vercel if the API hostname changes.
const phpApi = (
  process.env.TELEAD_PHP_API_URL || "https://teleads.sammiehosty.com/api"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${phpApi}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
