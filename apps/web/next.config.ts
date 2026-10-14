import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Stop next dev writing AGENTS.md/CLAUDE.md (#241). Documented: nextjs.org/docs/app/api-reference/config/next-config-js/agentRules
  agentRules: false,
  experimental: { optimizePackageImports: ["@untitledui/icons"] },
  // Workspace packages ship built `dist` (tsup); no transpilePackages needed.
  async redirects() {
    return [{ source: "/", destination: "/overview", permanent: false }];
  },
};

export default nextConfig;
