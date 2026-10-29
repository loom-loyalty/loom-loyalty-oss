# @loom-loyalty/test-utils

Shared test utilities for the FE CRUD UI Audit. Private workspace package.

## Subpath exports

| Path                                | Purpose                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@loom-loyalty/test-utils`          | Top-level re-exports                                                                                          |
| `@loom-loyalty/test-utils/manifest` | `loadManifest(entityCode)` — multi-strategy resolver for BE manifest JSON                                     |
| `@loom-loyalty/test-utils/zod`      | Shared refinements: `entityId`, `localizedString`, `durationPeriodValue`                                      |
| `@loom-loyalty/test-utils/axe`      | `vitest-axe` matcher re-exports + `installAxeMatchers()` setup helper                                         |
| `@loom-loyalty/test-utils/msw`      | MSW v2 setup re-exports (`setupServer`, `http`, `HttpResponse`); per-pilot handlers live with their consumers |

## Manifest loader

`loadManifest(entityCode)` resolves the BE-side data-model manifest for a given entity. Resolution order:

1. **Env var**: `process.env.LOOM_MANIFEST_DIR` points at a directory of `{ENTITY}.json` manifests
2. **Snapshot fallback**: `test-snapshots/manifest/{ENTITY}.json` at the FE repo root (committed; updated by `pnpm audit:sync-manifest`)

If both fail, throws an error listing every attempted path. The fallback path emits a `console.warn` so callers know the test is running against a snapshot, not the live BE.

## Zod refinements

```ts
import { entityId, localizedString, durationPeriodValue } from "@loom-loyalty/test-utils/zod";

const programIdSchema = entityId("prog");
//      ^^^^^^^^^^^^^^^^   z.string().regex(/^prog_[0-9a-f]{32}$/)

const descriptionSchema = localizedString;
//      ^^^^^^^^^^^^^^^   z.record(localeKey, z.string()) — empty values are
//                        stripped on parse, then `en` is required to remain
```

## MSW setup

```ts
import { setupServer, http, HttpResponse } from "@loom-loyalty/test-utils/msw";

const server = setupServer(http.get("/metadata", () => HttpResponse.json({ data: [] })));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Per-test override: `server.use(http.get("/metadata", () => HttpResponse.json({ data: [...] })))` inside an `it()` body swaps the handler for that test only.

## axe matchers

```ts
import { installAxeMatchers, axe, toHaveNoViolations } from "@loom-loyalty/test-utils/axe";

// In your packages/{ui,hub}/src/test/setup.ts:
installAxeMatchers();

// In a test:
const { container } = render(<MyComponent />);
expect(await axe(container)).toHaveNoViolations();
```
