import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT_ITEMS,
  buildRecentItemsKey,
  readRecentItems,
  rememberRecentItem,
  writeRecentItems,
  type CommandPaletteRecentItem,
} from "./recent-items";

function item(
  id: string,
  overrides: Partial<CommandPaletteRecentItem> = {}
): CommandPaletteRecentItem {
  return {
    entityId: id,
    entityType: "CUSTOMER",
    displayLabel: `Customer ${id}`,
    sourceUrl: `/customers/${id}`,
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("buildRecentItemsKey (brief D2)", () => {
  it("keys by app, user and organization environment", () => {
    expect(buildRecentItemsKey("dashboard", "user_1", "env_1")).toBe(
      "loom-command-palette-recent:dashboard:user_1:env_1"
    );
  });

  it("returns null until both user and environment are known", () => {
    expect(buildRecentItemsKey("hub", null, "env_1")).toBeNull();
    expect(buildRecentItemsKey("hub", "user_1", undefined)).toBeNull();
  });

  it("property (I2): distinct user/environment pairs never share a key", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (userA, envA, userB, envB) => {
          fc.pre(userA !== userB || envA !== envB);
          expect(buildRecentItemsKey("hub", userA, envA)).not.toBe(
            buildRecentItemsKey("hub", userB, envB)
          );
        }
      )
    );
  });

  it("property (I2): items written for one environment are never read for another", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (envA, envB) => {
        fc.pre(envA !== envB);
        window.localStorage.clear();
        writeRecentItems(buildRecentItemsKey("hub", "u", envA), [item("a")]);
        expect(readRecentItems(buildRecentItemsKey("hub", "u", envB))).toEqual([]);
      })
    );
  });

  it("gives different organization environments different keys", () => {
    expect(buildRecentItemsKey("hub", "u", "env_a")).not.toBe(
      buildRecentItemsKey("hub", "u", "env_b")
    );
  });
});

describe("rememberRecentItem (brief D2b)", () => {
  it("puts the newest item first", () => {
    expect(rememberRecentItem([item("a")], item("b")).map((i) => i.entityId)).toEqual(["b", "a"]);
  });

  it("keeps one entry for an item opened twice and moves it to the top", () => {
    const list = rememberRecentItem([item("a"), item("b")], item("b"));
    expect(list.map((i) => i.entityId)).toEqual(["b", "a"]);
  });

  it(`caps the list at ${MAX_RECENT_ITEMS}`, () => {
    let list: CommandPaletteRecentItem[] = [];
    for (const id of ["1", "2", "3", "4", "5", "6", "7"]) list = rememberRecentItem(list, item(id));
    expect(list.map((i) => i.entityId)).toEqual(["7", "6", "5", "4", "3"]);
  });

  it("property: never longer than the cap, never duplicated, newest always first", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "b", "c", "d", "e", "f", "g"), { maxLength: 40 }),
        (ids) => {
          let list: CommandPaletteRecentItem[] = [];
          for (const id of ids) list = rememberRecentItem(list, item(id));
          expect(list.length).toBeLessThanOrEqual(MAX_RECENT_ITEMS);
          expect(new Set(list.map((i) => i.entityId)).size).toBe(list.length);
          if (ids.length > 0) expect(list[0]!.entityId).toBe(ids[ids.length - 1]);
        }
      )
    );
  });
});

describe("read/writeRecentItems (brief D2, D2b)", () => {
  it("round-trips only the ID, label, type and URL", () => {
    const key = "k";
    writeRecentItems(key, [
      { ...item("a"), snippetText: "secret@example.com" } as CommandPaletteRecentItem,
    ]);
    const stored = JSON.parse(window.localStorage.getItem(key)!);
    expect(Object.keys(stored.items[0]).sort()).toEqual([
      "displayLabel",
      "entityId",
      "entityType",
      "sourceUrl",
    ]);
    expect(readRecentItems(key)).toEqual([item("a")]);
  });

  it("does not show one organization environment's items in another", () => {
    const keyA = buildRecentItemsKey("hub", "u", "env_a")!;
    const keyB = buildRecentItemsKey("hub", "u", "env_b")!;
    writeRecentItems(keyA, [item("a")]);
    expect(readRecentItems(keyB)).toEqual([]);
  });

  it("returns an empty list for a null key", () => {
    expect(readRecentItems(null)).toEqual([]);
  });

  it("drops malformed storage instead of throwing", () => {
    window.localStorage.setItem("k", "{not json");
    expect(readRecentItems("k")).toEqual([]);
    window.localStorage.setItem("k", JSON.stringify({ version: 1, items: [{ entityId: 3 }] }));
    expect(readRecentItems("k")).toEqual([]);
  });

  it("survives storage that throws (private mode, blocked site data)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeRecentItems("k", [item("a")])).not.toThrow();
    expect(readRecentItems("k")).toEqual([]);
  });
});
