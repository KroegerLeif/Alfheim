import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@loeger-os/shared"],
};

export default nextConfig;
