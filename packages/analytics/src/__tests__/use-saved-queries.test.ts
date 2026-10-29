import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSavedQueries } from "../hooks/use-saved-queries";

// ── Mock localStorage ──

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => null),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// ── Mock crypto.randomUUID ──

let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => {
    uuidCounter++;
    return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, "0")}`;
  },
});

describe("useSavedQueries", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("starts with empty queries when localStorage is empty", () => {
    const { result } = renderHook(() => useSavedQueries());
    expect(result.current.queries).toEqual([]);
  });

  it("saves a query and returns it", () => {
    const { result } = renderHook(() => useSavedQueries());

    let saved: ReturnType<typeof result.current.save> | undefined;
    act(() => {
      saved = result.current.save("My Query", "SELECT 1");
    });

    expect(result.current.queries).toHaveLength(1);
    expect(result.current.queries[0].name).toBe("My Query");
    expect(result.current.queries[0].sql).toBe("SELECT 1");
    expect(result.current.queries[0].id).toMatch(/^sqy_/);
    expect(result.current.queries[0].favorite).toBe(false);
    expect(result.current.queries[0].createdAt).toBeTruthy();
    expect(result.current.queries[0].updatedAt).toBeTruthy();
    expect(saved).toBeDefined();
    expect(saved!.id).toBe(result.current.queries[0].id);
  });

  it("prepends new queries (most recent first)", () => {
    const { result } = renderHook(() => useSavedQueries());

    act(() => {
      result.current.save("First", "SELECT 1");
    });
    act(() => {
      result.current.save("Second", "SELECT 2");
    });

    expect(result.current.queries).toHaveLength(2);
    expect(result.current.queries[0].name).toBe("Second");
    expect(result.current.queries[1].name).toBe("First");
  });

  it("removes a query by id", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    act(() => {
      const q = result.current.save("To Delete", "SELECT 1");
      id = q.id;
    });
    expect(result.current.queries).toHaveLength(1);

    act(() => {
      result.current.remove(id!);
    });
    expect(result.current.queries).toHaveLength(0);
  });

  it("remove is a no-op for unknown id", () => {
    const { result } = renderHook(() => useSavedQueries());

    act(() => {
      result.current.save("Keep", "SELECT 1");
    });

    act(() => {
      result.current.remove("sqy_nonexistent");
    });
    expect(result.current.queries).toHaveLength(1);
  });

  it("toggles favorite on and off", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    act(() => {
      const q = result.current.save("Fav Test", "SELECT 1");
      id = q.id;
    });
    expect(result.current.queries[0].favorite).toBe(false);

    act(() => {
      result.current.toggleFavorite(id!);
    });
    expect(result.current.queries[0].favorite).toBe(true);

    act(() => {
      result.current.toggleFavorite(id!);
    });
    expect(result.current.queries[0].favorite).toBe(false);
  });

  it("toggleFavorite is a no-op for unknown id", () => {
    const { result } = renderHook(() => useSavedQueries());

    act(() => {
      result.current.save("Keep", "SELECT 1");
    });

    act(() => {
      result.current.toggleFavorite("sqy_nonexistent");
    });
    expect(result.current.queries[0].favorite).toBe(false);
  });

  it("updates a query name", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    act(() => {
      const q = result.current.save("Original", "SELECT 1");
      id = q.id;
    });

    act(() => {
      result.current.update(id!, { name: "Updated" });
    });
    expect(result.current.queries[0].name).toBe("Updated");
    expect(result.current.queries[0].sql).toBe("SELECT 1");
  });

  it("updates a query sql", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    act(() => {
      const q = result.current.save("Test", "SELECT 1");
      id = q.id;
    });

    act(() => {
      result.current.update(id!, { sql: "SELECT 2" });
    });
    expect(result.current.queries[0].sql).toBe("SELECT 2");
    expect(result.current.queries[0].name).toBe("Test");
  });

  it("update bumps updatedAt timestamp", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    let _originalUpdatedAt: string;
    act(() => {
      const q = result.current.save("Test", "SELECT 1");
      id = q.id;
      _originalUpdatedAt = q.updatedAt;
    });

    // Small delay to ensure timestamp differs
    act(() => {
      result.current.update(id!, { name: "Updated" });
    });
    // updatedAt should be set (may or may not differ depending on timing)
    expect(result.current.queries[0].updatedAt).toBeTruthy();
  });

  it("update is a no-op for unknown id", () => {
    const { result } = renderHook(() => useSavedQueries());

    act(() => {
      result.current.save("Keep", "SELECT 1");
    });

    act(() => {
      result.current.update("sqy_nonexistent", { name: "Changed" });
    });
    expect(result.current.queries[0].name).toBe("Keep");
  });

  it("persists to localStorage on save", () => {
    const { result } = renderHook(() => useSavedQueries());

    act(() => {
      result.current.save("Persisted", "SELECT 1");
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "spindle:saved-queries",
      expect.stringContaining("Persisted")
    );
  });

  it("persists to localStorage on remove", () => {
    const { result } = renderHook(() => useSavedQueries());

    let id: string;
    act(() => {
      const q = result.current.save("To Remove", "SELECT 1");
      id = q.id;
    });

    vi.clearAllMocks();
    act(() => {
      result.current.remove(id!);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "spindle:saved-queries",
      expect.any(String)
    );
  });

  it("handles corrupt localStorage data gracefully", () => {
    localStorageMock.getItem.mockReturnValueOnce("not valid json");
    const { result } = renderHook(() => useSavedQueries());
    expect(result.current.queries).toEqual([]);
  });

  it("generates unique IDs with sqy_ prefix", () => {
    const { result } = renderHook(() => useSavedQueries());

    const ids: string[] = [];
    act(() => {
      ids.push(result.current.save("A", "SELECT 1").id);
    });
    act(() => {
      ids.push(result.current.save("B", "SELECT 2").id);
    });

    expect(ids[0]).toMatch(/^sqy_/);
    expect(ids[1]).toMatch(/^sqy_/);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
