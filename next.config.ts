import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/share/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  // Enter browser sign-in on the canonical host so OAuth state cookies
  // and the registered WHOOP callback always share the same origin.
  async redirects() {
    return [
      "/",
      "/privacy",
      "/sign-in/:path*",
      "/settings/:path*",
      "/dashboard",
      "/api/auth/whoop/start",
    ].map((source) => ({
      source,
      has: [{ type: "host" as const, value: "whooper-peach.vercel.app" }],
      destination: `https://whooper.eazylee.si${source}`,
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
