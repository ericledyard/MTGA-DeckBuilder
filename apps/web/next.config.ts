import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["stream-json"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "imgs.scryfall.io" },
      { protocol: "https", hostname: "svgs.scryfall.io" },
    ],
  },
};

export default nextConfig;
