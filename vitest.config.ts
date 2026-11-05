import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" so tests import modules the same way app code does.
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts?(x)"],
    coverage: {
      provider: "v8",
      // Only the pure domain logic is held to coverage; UI is covered by behaviour tests.
      include: ["lib/**"],
    },
  },
});
