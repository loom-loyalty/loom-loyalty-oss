/**
 * @vitest-environment jsdom
 *
 * Tests for the cross-tab auth-context watchdog.
 *
 * `isOutOfSync` is the pure, unit-tested core. `broadcastContextChange` is
 * exercised against jsdom's storage + a stubbed BroadcastChannel to verify the
 * channel post and localStorage fallback.
 *
 * `useContextWatchdog` is mounted via `renderHook` to verify it reads the
 * *latest* in-memory context on each signal — a regression guard against a
 * stale first-render closure that returned null forever, so a tab never
 * reloaded after its auth context finished loading.
 */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  broadcastContextChange,
  isOutOfSync,
  useContextWatchdog,
  type ContextChangeMessage,
  type ContextSnapshot,
} from "./use-context-watchdog";

describe("isOutOfSync", () => {
  const msg = (orgKey: string, envId?: string): ContextChangeMessage => ({
    type: "context-changed",
    orgKey,
    ...(envId !== undefined ? { envId } : {}),
  });
  const mem = (orgKey: string | null, envId?: string | null): ContextSnapshot => ({
    orgKey,
    ...(envId !== undefined ? { envId } : {}),
  });

  it("returns false when org and env match", () => {
    expect(isOutOfSync(mem("org_1", "env_a"), msg("org_1", "env_a"))).toBe(false);
  });

  it("returns false when orgs match and no env on either side", () => {
    expect(isOutOfSync(mem("org_1"), msg("org_1"))).toBe(false);
  });

  it("returns true when the org id differs", () => {
    expect(isOutOfSync(mem("org_1"), msg("org_2"))).toBe(true);
  });

  it("returns true when the env differs for the same org", () => {
    expect(isOutOfSync(mem("org_1", "env_a"), msg("org_1", "env_b"))).toBe(true);
  });

  it("returns false when in-memory org id is null (not loaded yet)", () => {
    expect(isOutOfSync(mem(null), msg("org_2"))).toBe(false);
  });

  it("returns false when in-memory org id is null even if envs differ", () => {
    expect(isOutOfSync(mem(null, "env_a"), msg("org_2", "env_b"))).toBe(false);
  });

  it("returns false when the message has an env but in-memory env is null (cannot compare)", () => {
    expect(isOutOfSync(mem("org_1", null), msg("org_1", "env_b"))).toBe(false);
  });

  it("returns false when in-memory has an env but the message has none (cannot compare)", () => {
    expect(isOutOfSync(mem("org_1", "env_a"), msg("org_1"))).toBe(false);
  });

  it("prioritizes an org mismatch over matching envs", () => {
    expect(isOutOfSync(mem("org_1", "env_a"), msg("org_2", "env_a"))).toBe(true);
  });
});

describe("broadcastContextChange", () => {
  let posted: unknown[];
  let closed: number;

  beforeEach(() => {
    posted = [];
    closed = 0;
    window.sessionStorage.clear();
    window.localStorage.clear();

    class FakeBroadcastChannel {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(message: unknown): void {
        posted.push(message);
      }
      close(): void {
        closed += 1;
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a context-changed message on the channel and closes it", () => {
    broadcastContextChange("org_2", "env_b");
    expect(posted).toEqual([{ type: "context-changed", orgKey: "org_2", envId: "env_b" }]);
    expect(closed).toBe(1);
  });

  it("omits envId from the message when not provided", () => {
    broadcastContextChange("org_2");
    expect(posted).toEqual([{ type: "context-changed", orgKey: "org_2" }]);
  });

  it("mirrors the payload (plus a timestamp) to localStorage as a fallback", () => {
    broadcastContextChange("org_2", "env_b");
    const raw = window.localStorage.getItem("loom-auth-context-change");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(parsed.type).toBe("context-changed");
    expect(parsed.orgKey).toBe("org_2");
    expect(parsed.envId).toBe("env_b");
    expect(typeof parsed.ts).toBe("number");
  });

  it("still writes the localStorage fallback when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    broadcastContextChange("org_3");
    expect(window.localStorage.getItem("loom-auth-context-change")).not.toBeNull();
  });
});

describe("useContextWatchdog (mount)", () => {
  const originalLocation = window.location;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: originalLocation.href, origin: originalLocation.origin, reload: reloadSpy },
    });
  });

  afterEach(() => {
    cleanup(); // unmount rendered hooks so their listeners don't leak across tests
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  // Announce a context change from "another tab" via the storage-event transport.
  const announce = (orgKey: string): void => {
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "loom-auth-context-change",
          newValue: JSON.stringify({ type: "context-changed", orgKey, ts: Date.now() }),
        })
      );
    });
  };

  it("reloads using context that loaded AFTER mount, not the first-render closure", () => {
    // First render: auth not loaded yet, so the reader reports a null org.
    const { rerender } = renderHook(({ reader }) => useContextWatchdog(reader), {
      initialProps: { reader: (): ContextSnapshot => ({ orgKey: null }) },
    });
    // Auth resolves on a later render: a NEW reader closing over the real org.
    rerender({ reader: (): ContextSnapshot => ({ orgKey: "org_A" }) });

    announce("org_B"); // another tab switched to a different org
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does not reload while the in-memory org is still null (tab not initialized)", () => {
    renderHook(() => useContextWatchdog((): ContextSnapshot => ({ orgKey: null })));
    announce("org_B");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not reload when the announced org matches the current context", () => {
    renderHook(() => useContextWatchdog((): ContextSnapshot => ({ orgKey: "org_A" })));
    announce("org_A");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("keeps listening after a reload — reacts once the suppress window elapses", () => {
    // Simulate a tab that just reloaded via the watchdog: suppress window armed.
    window.sessionStorage.setItem("loom-watchdog-suppress-until", String(Date.now() + 5000));
    renderHook(() => useContextWatchdog((): ContextSnapshot => ({ orgKey: "org_A" })));

    // A switch landing inside the suppress window is ignored (no reload loop).
    announce("org_B");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(reloadSpy).not.toHaveBeenCalled();

    // Window elapses (clear the key) → the tab is still subscribed and reacts to
    // the next switch. Regression: the effect used to early-return on the
    // suppress/initiator guard and never register listeners, going deaf for the
    // whole page load.
    window.sessionStorage.removeItem("loom-watchdog-suppress-until");
    announce("org_C");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
