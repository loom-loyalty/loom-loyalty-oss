import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { setupServer } from "./index.js";
import { paginatedListHandler } from "./paginated-list.js";

interface Item {
  id: string;
  name: string;
}

const ITEMS: Item[] = Array.from({ length: 137 }, (_, i) => ({
  id: `id-${i}`,
  name: `Item ${i}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface PagedItemBody {
  content: Item[];
  totalSize: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
}

async function fetchPage(url: string): Promise<PagedItemBody> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return (await response.json()) as PagedItemBody;
}

describe("[audit] paginatedListHandler", () => {
  it("returns the first page with the configured default page size", async () => {
    server.use(paginatedListHandler({ url: "https://api.test/items", items: ITEMS }));

    const body = await fetchPage("https://api.test/items?page=0");

    expect(body.content).toHaveLength(50);
    expect(body.content[0]?.id).toBe("id-0");
    expect(body.totalSize).toBe(137);
    expect(body.totalPages).toBe(3);
    expect(body.pageNumber).toBe(0);
    expect(body.pageSize).toBe(50);
  });

  it("honors caller-supplied size", async () => {
    server.use(paginatedListHandler({ url: "https://api.test/items", items: ITEMS }));

    const body = await fetchPage("https://api.test/items?page=1&size=20");

    expect(body.content).toHaveLength(20);
    expect(body.content[0]?.id).toBe("id-20");
    expect(body.totalPages).toBe(7);
    expect(body.pageNumber).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it("returns a partial last page", async () => {
    server.use(paginatedListHandler({ url: "https://api.test/items", items: ITEMS }));

    const body = await fetchPage("https://api.test/items?page=2&size=50");

    expect(body.content).toHaveLength(37);
    expect(body.content.at(-1)?.id).toBe("id-136");
    expect(body.pageNumber).toBe(2);
  });

  it("returns an empty page past the end", async () => {
    server.use(paginatedListHandler({ url: "https://api.test/items", items: ITEMS }));

    const body = await fetchPage("https://api.test/items?page=99&size=50");

    expect(body.content).toEqual([]);
    expect(body.totalSize).toBe(137);
  });

  it("falls back to defaults for missing or invalid params", async () => {
    server.use(
      paginatedListHandler({ url: "https://api.test/items", items: ITEMS, defaultPageSize: 25 })
    );

    const body = await fetchPage("https://api.test/items?page=abc&size=-5");

    expect(body.pageNumber).toBe(0);
    expect(body.pageSize).toBe(25);
    expect(body.content).toHaveLength(25);
  });

  it("applies an optional filter before pagination", async () => {
    server.use(
      paginatedListHandler<Item>({
        url: "https://api.test/items",
        items: ITEMS,
        filter: (item, params) => {
          const name = params.get("name");
          return name ? item.name.includes(name) : true;
        },
      })
    );

    const body = await fetchPage("https://api.test/items?page=0&size=50&name=Item%2013");

    // 137 items: "Item 13" matches "Item 13" + "Item 130".."Item 136" = 8 results.
    expect(body.totalSize).toBe(8);
    expect(body.content.every((item) => item.name.includes("Item 13"))).toBe(true);
  });

  it("supports RegExp URLs", async () => {
    server.use(paginatedListHandler({ url: /\/items$/, items: ITEMS }));

    const body = await fetchPage("https://other.test/api/v1/items?page=0&size=10");

    expect(body.content).toHaveLength(10);
  });
});
