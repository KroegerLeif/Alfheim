import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@alfheim/shared"],
  // Profile management moved to the core/household app (served under /household).
  async redirects() {
    return [
      { source: "/profile", destination: "/household/profile", permanent: false },
    ];
  },
};

export default nextConfig;
