import { installAxeMatchers } from "@loom-loyalty/test-utils/axe";
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
