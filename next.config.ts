import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion and the render worker run outside Next; keep them out of the server bundle.
  serverExternalPackages: ["remotion"],
};

export default nextConfig;
