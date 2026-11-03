import { installAxeMatchers } from "@loom-loyalty/test-utils/axe";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

import { installIntersectionObserverMock } from "./intersection-observer";

installAxeMatchers();
installIntersectionObserverMock();

// Mock matchMedia (needed for responsive hooks)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// jsdom lacks Element.prototype.scrollIntoView — cmdk calls it on item highlight.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// jsdom also lacks pointer-capture, which Radix Select/Dialog rely on.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
}

export {};

// `@testing-library/jest-dom/vitest` adds its matchers to whichever `vitest` it resolves from its
// own install folder. The lockfile holds more than one `vitest` copy (they differ only in their
// `@types/node` peer), so a fresh install, such as the public repo's, can resolve a copy this
// package does not use, and every jest-dom matcher then fails to type-check. Declaring them here
// ties them to the `vitest` this package resolves.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors jest-dom's own declaration
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors jest-dom's own declaration
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
