import { typescriptConfig } from "@loom-loyalty/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...typescriptConfig,
  {
    ignores: ["dist/**"],
  },
  {
    // The installer prints its results to the terminal
    rules: {
      "no-console": "off",
    },
  },
];
