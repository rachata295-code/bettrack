import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-only app: static export so it can be hosted anywhere without a server.
  output: "export",
  // The image optimizer needs a server; unoptimized keeps export working.
  images: { unoptimized: true },
};

export default nextConfig;
