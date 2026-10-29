/**
 * vitest-axe matcher re-exports for accessibility testing across packages.
 *
 * Consumers (packages/ui, apps/hub) call `installAxeMatchers()` once in
 * their test setup file to register the `toHaveNoViolations` matcher on
 * Vitest's `expect`. Then in tests:
 *
 *   const results = await axe(container);
 *   expect(results).toHaveNoViolations();
 *
 * `vitest-axe` internally uses `axe-core`, which requires a real DOM. The
 * matchers only work under `environment: "jsdom"`.
 */

import "vitest";
import { expect } from "vitest";
import { axe, configureAxe } from "vitest-axe";
// vitest-axe's `matchers.d.ts` ships an `export type *` re-export that
// makes TypeScript see runtime values as types-only. Importing from the
// dist subpath (which has a regular value re-export) sidesteps the bug.
import { toHaveNoViolations, type AxeMatchers } from "vitest-axe/dist/matchers";

// Augment Vitest's Assertion type with the axe matchers so consumers get
// type-safe `expect(results).toHaveNoViolations()` without importing
// vitest-axe/extend-expect (which only carries types, not the runtime
// expect.extend call). Mirrors the @testing-library/jest-dom/vitest
// augmentation pattern for vitest 3.x.
//
// AsymmetricMatchersContaining is intentionally NOT augmented — calling
// `expect.toHaveNoViolations()` in asymmetric position would dereference an
// undefined results object at runtime. AxeMatchers takes a results value;
// it's not an asymmetric matcher.
declare module "vitest" {
  interface Assertion<T> extends AxeMatchers {
    /** Phantom field consuming the T parameter so TypeScript doesn't fire
     *  TS6133 ("T is declared but its value is never read") under
     *  `noUnusedParameters: true`. AxeMatchers itself has no T usage; this
     *  is the cheapest type-only workaround. Field is optional and never
     *  assigned, so it has zero runtime impact. */
    readonly _axeAssertionT?: T;
  }
}

/** Register the `toHaveNoViolations` matcher on Vitest's `expect`. Idempotent;
 *  safe to call from multiple setup files. */
export function installAxeMatchers(): void {
  expect.extend({ toHaveNoViolations });
}

export { axe, configureAxe, toHaveNoViolations };
