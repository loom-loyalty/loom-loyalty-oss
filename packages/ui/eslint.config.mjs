import { reactConfig } from "@loom-loyalty/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...reactConfig,
  {
    ignores: ["dist/**"],
  },
  {
    files: ["src/openui/**/*.tsx"],
    rules: {
      // OpenUI's defineComponent API uses a lowercase `component` callback
      // where React hooks are the expected pattern
      "react-hooks/rules-of-hooks": "off",
    },
  },
];
