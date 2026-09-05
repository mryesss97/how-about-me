import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ["@untitledui/icons"] },
  // Workspace packages ship built `dist` (tsup); no transpilePackages needed.
  async redirects() {
    return [{ source: "/", destination: "/overview", permanent: false }];
  },
};

export default nextConfig;
