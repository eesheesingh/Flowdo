import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".claude/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Serialize test files (default is parallel across workers) so sign-ins
    // across the whole suite come from one process at a time. Supabase
    // Auth's per-IP rate limiter is a token bucket with a hard ~30-request
    // burst capacity regardless of the configured sustained rate; parallel
    // files each doing their own bursts of sign-ins is what was tripping it.
    fileParallelism: false,
  },
});
