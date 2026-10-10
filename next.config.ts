import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enter browser sign-in on the canonical host so OAuth state cookies
  // and the registered WHOOP callback always share the same origin.
  async redirects() {
    return ["/", "/privacy", "/sign-in/:path*", "/settings/:path*", "/api/auth/whoop/start"].map(source => ({
      source,
      has: [{ type: "host" as const, value: "whooper-peach.vercel.app" }],
      destination: `https://whooper.ccwu.cc${source}`,
      permanent: false,
    }));
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
