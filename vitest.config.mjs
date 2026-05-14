import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    globals: false,
    passWithNoTests: true,
    environmentMatchGlobs: [
      ["tests/convex/**", "edge-runtime"],
      ["hooks/__tests__/**", "happy-dom"],
      ["**", "node"],
    ],
    include: [
      "lib/**/*.test.ts",
      "tests/convex/**/*.test.ts",
      "hooks/__tests__/**/*.test.tsx",
    ],
    env: {
      N8N_WEBHOOK_DISABLED: "true",
      CLERK_JWT_ISSUER_DOMAIN: "https://test.clerk.accounts.dev",
    },
  },
});
