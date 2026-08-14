import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolves the "@/*" alias from tsconfig.json natively — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Without this, vitest walks the whole app tree and tries to run route files.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
