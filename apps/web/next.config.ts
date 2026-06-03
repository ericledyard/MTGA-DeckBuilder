import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "imgs.scryfall.io" },
    ],
  },
};

export default nextConfig;
