import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/workout",
  transpilePackages: ["@alfheim/shared"],
};

export default withNextIntl(nextConfig);
