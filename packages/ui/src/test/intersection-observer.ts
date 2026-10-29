/**
 * Controllable IntersectionObserver mock for jsdom test environments.
 *
 * jsdom does not implement IntersectionObserver, so any code using it
 * crashes under vitest. This mock registers a fake constructor on `window`
 * and exposes `triggerIntersection()` so tests can simulate scroll-to-bottom
 * driving infinite-scroll sentinels.
 */

interface MockEntry {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
  time: number;
  rootBounds: DOMRectReadOnly | null;
  boundingClientRect: DOMRectReadOnly;
  intersectionRect: DOMRectReadOnly;
}

class MockObserver {
  callback: IntersectionObserverCallback;
  elements = new Set<Element>();
  root: Document | Element | null = null;
  rootMargin = "";
  thresholds: number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    instances.add(this);
  }

  observe(target: Element): void {
    this.elements.add(target);
  }

  unobserve(target: Element): void {
    this.elements.delete(target);
  }

  disconnect(): void {
    this.elements.clear();
    instances.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const instances = new Set<MockObserver>();

export function installIntersectionObserverMock(): void {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockObserver,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockObserver,
  });
}

/**
 * Fire an intersection event on every active mock observer.
 */
export function triggerIntersection(isIntersecting = true): void {
  for (const observer of instances) {
    const entries: MockEntry[] = Array.from(observer.elements).map((target) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      time: Date.now(),
      rootBounds: null,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
    }));
    observer.callback(
      entries as unknown as IntersectionObserverEntry[],
      observer as unknown as IntersectionObserver
    );
  }
}

export function resetIntersectionObservers(): void {
  for (const observer of instances) observer.disconnect();
  instances.clear();
}
