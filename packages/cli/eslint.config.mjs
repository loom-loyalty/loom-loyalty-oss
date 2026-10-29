import { typescriptConfig } from "@loom-loyalty/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...typescriptConfig,
  {
    ignores: ["dist/**"],
  },
  {
    // CLI tools use console for user output
    rules: {
      "no-console": "off",
    },
  },
];
