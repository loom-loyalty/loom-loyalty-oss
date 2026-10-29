import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    server: {
      deps: {
        // Pre-bundle OpenUI packages that use directory imports incompatible with Node ESM
        inline: ["@openuidev/react-ui", "@openuidev/react-headless", "@openuidev/react-lang"],
      },
    },
  },
});
