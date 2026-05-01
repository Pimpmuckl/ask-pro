import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      all: true,
      include: ["src/ask-pro/**/*.ts", "src/browser/**/*.ts", "bin/ask-pro-cli.ts"],
      exclude: [
        "src/browser/actions/**",
        "src/browser/index.ts",
        "src/browser/pageActions.ts",
        "src/browser/chromeLifecycle.ts",
        "src/browserMode.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@src": fileURLToPath(new URL("./src", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
});
