import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` (Prisma driver adapter) is a Node library — keep it out of the bundle.
  serverExternalPackages: ["pg"],

  // Govt captcha (API 7) returns base64, so no remote image loading needed.
  // We never render <Image> from an external host.
};

export default nextConfig;
