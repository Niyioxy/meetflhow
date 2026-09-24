import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Each file boots an in-process Postgres (PGlite) and runs every migration.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
