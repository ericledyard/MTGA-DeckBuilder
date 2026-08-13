import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Scryfall's CDN rejects any request whose User-Agent is "default or
    // generic" — which is exactly what Next's server-side image optimizer
    // sends when it runs locally, so every card image 400s in `next dev`.
    // Vercel's optimizer sends an accepted UA, so production is unaffected:
    // bypass optimization in dev only and keep it everywhere else.
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "imgs.scryfall.io" },
      { protocol: "https", hostname: "svgs.scryfall.io" },
    ],
  },
};

export default nextConfig;
