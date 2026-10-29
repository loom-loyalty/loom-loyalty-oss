import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalStorageSavedViewsAdapter, type SavedView } from "./saved-views-store";

const SCOPE = "acme:env_1:offer";
const KEY = `loom-hub-saved-views:${SCOPE}`;

function makeView(id: string, overrides?: Partial<SavedView>): SavedView {
  return { id, name: `View ${id}`, search: { q: id }, createdAt: 1000, ...overrides };
}

describe("createLocalStorageSavedViewsAdapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    expect(adapter.list(SCOPE)).toEqual([]);
  });

  it("saves, lists, and persists to localStorage with a versioned envelope", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save(SCOPE, makeView("a"));

    expect(adapter.list(SCOPE).map((v) => v.id)).toEqual(["a"]);
    const parsed = JSON.parse(window.localStorage.getItem(KEY)!) as {
      version: number;
      views: SavedView[];
    };
    expect(parsed.version).toBe(1);
    expect(parsed.views).toHaveLength(1);
  });

  it("prepends new views and upserts by id", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save(SCOPE, makeView("a"));
    adapter.save(SCOPE, makeView("b"));
    expect(adapter.list(SCOPE).map((v) => v.id)).toEqual(["b", "a"]);

    adapter.save(SCOPE, makeView("a", { name: "Renamed" }));
    expect(adapter.list(SCOPE).map((v) => v.id)).toEqual(["a", "b"]);
    expect(adapter.list(SCOPE)[0]?.name).toBe("Renamed");
  });

  it("removes by id", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save(SCOPE, makeView("a"));
    adapter.save(SCOPE, makeView("b"));
    adapter.remove(SCOPE, "a");
    expect(adapter.list(SCOPE).map((v) => v.id)).toEqual(["b"]);
  });

  it("scopes views independently", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save("scope-1", makeView("a"));
    adapter.save("scope-2", makeView("b"));
    expect(adapter.list("scope-1").map((v) => v.id)).toEqual(["a"]);
    expect(adapter.list("scope-2").map((v) => v.id)).toEqual(["b"]);
  });

  it("returns a stable reference until the data changes", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save(SCOPE, makeView("a"));
    const first = adapter.list(SCOPE);
    expect(adapter.list(SCOPE)).toBe(first);
    adapter.save(SCOPE, makeView("b"));
    expect(adapter.list(SCOPE)).not.toBe(first);
  });

  it("discards corrupt storage and clears the key", () => {
    window.localStorage.setItem(KEY, "{not valid json");
    const adapter = createLocalStorageSavedViewsAdapter();
    expect(adapter.list(SCOPE)).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("discards data that fails schema validation", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, views: [] }));
    const adapter = createLocalStorageSavedViewsAdapter();
    expect(adapter.list(SCOPE)).toEqual([]);
  });

  it("caps stored views at the maximum", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    for (let i = 0; i < 55; i++) {
      adapter.save(SCOPE, makeView(`v${i}`));
    }
    expect(adapter.list(SCOPE).length).toBe(50);
  });

  it("notifies same-tab subscribers on save and remove", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(SCOPE, listener);

    adapter.save(SCOPE, makeView("a"));
    expect(listener).toHaveBeenCalledTimes(1);

    adapter.remove(SCOPE, "a");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    adapter.save(SCOPE, makeView("b"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not broadcast or change persisted state when persistence fails", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    adapter.save(SCOPE, makeView("a"));
    const listener = vi.fn();
    adapter.subscribe(SCOPE, listener);

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    adapter.save(SCOPE, makeView("b"));
    spy.mockRestore();

    expect(listener).not.toHaveBeenCalled();
    expect(adapter.list(SCOPE).map((v) => v.id)).toEqual(["a"]);
  });

  it("notifies subscribers on a cross-tab storage event for the matching key", () => {
    const adapter = createLocalStorageSavedViewsAdapter();
    const listener = vi.fn();
    adapter.subscribe(SCOPE, listener);

    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
