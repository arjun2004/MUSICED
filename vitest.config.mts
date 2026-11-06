import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    // Loads .env.local etc. (all keys, not only VITE_*) for integration tests.
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
  },
}));
