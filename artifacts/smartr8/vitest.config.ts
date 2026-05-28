import { defineConfig } from "vitest/config";
import path from "node:path";

// Node-environment vitest config for the Cloudflare Pages Functions test
// suite. No DOM is needed — every test file under functions/ exercises
// server-side helpers, the orchestrator, or the retry cron. The
// path alias mirrors vite.config.ts so `@/...` keeps resolving in tests.
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "functions/**/*.test.ts",
      "functions/**/*.test.tsx",
    ],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
