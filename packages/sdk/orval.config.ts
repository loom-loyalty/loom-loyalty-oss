import { defineConfig } from "orval";

export default defineConfig({
  // React Query hooks + TypeScript types
  loomLoyalty: {
    input: {
      target: "../../openapi.yaml",
      // Breaks polymorphic subtype cycles (self-referencing types otherwise) and drops error
      // response bodies (sdkFetch throws on non-2xx, so they never reach `data`); see the scripts.
      override: { transformer: "./scripts/transform-spec.mjs" },
    },
    output: {
      mode: "tags",
      target: "./src/generated/api/index.ts",
      schemas: "./src/generated/schemas",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: {
          path: "./src/core/sdk-client.ts",
          name: "sdkFetch",
        },
        query: {
          useQuery: true,
          useMutation: true,
          useSuspenseQuery: false,
          useSuspenseInfiniteQuery: false,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
  // Zod schema generation is DISABLED. See issue #765.
  //
  // It could not generate the current spec at all, and it blocked every
  // `openapi.yaml` refresh with it:
  //
  //   mode: "single"  ->  RangeError: Invalid string length (exceeds V8's max
  //                       string length while assembling one output file)
  //   mode: "tags"    ->  Node heap OOM at 8GB after ~25 minutes
  //
  // `prebuild` runs `generate`, so this failure was not confined to the
  // generate step; it stalled builds too.
  //
  // Note the same V8 string-length ceiling blocks the DOCS pipeline for an
  // unrelated reason (#766). Disabling this target unblocks SDK generation but
  // not the `openapi.yaml` refresh itself.
  //
  // Nothing consumed the output. The barrel script wrote `export {}` over the
  // single-file target, so `@loom-loyalty/sdk/zod` had exported nothing since
  // 2026-08-14, and no app or package imports it. The repo's real Zod usage is
  // hand-written (schema-form and friends) and unaffected by this.
  //
  // Re-enabling is a design question, not a config toggle: whether generated
  // schemas for a spec this size are worth having, and if so scoped to which
  // endpoints. That is what the issue tracks. Do not simply uncomment this.
});
