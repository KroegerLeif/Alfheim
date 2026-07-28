import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/maintenance",
  transpilePackages: ["@loeger-os/shared"],
  /* config options here */
};

export default withNextIntl(nextConfig);
