import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Served by Caddy under /household on the shared host.
  // Keep in sync with HOUSEHOLD_BASE_PATH in src/lib/routes.ts.
  basePath: "/household",
  transpilePackages: ["@alfheim/shared"],
};

export default nextConfig;
