import type { FeedItem } from "@knocklabs/client";
import { describe, expect, it } from "vitest";

import { mapFeedItem } from "./map-feed-item";

function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    __cursor: "c",
    id: "msg_1",
    actors: [],
    blocks: [
      {
        name: "body",
        type: "markdown",
        content: "**Approval needed: Gold tier**\n\nAda asked to enable it in PROD.",
        rendered: "",
      },
    ],
    inserted_at: "2026-10-23T12:00:00Z",
    updated_at: "2026-10-23T12:00:00Z",
    read_at: null,
    seen_at: null,
    clicked_at: null,
    interacted_at: null,
    link_clicked_at: null,
    archived_at: null,
    total_actors: 0,
    data: { hubPath: "/organization/approvals?request=wkrq_1&step=wksa_1" },
    source: { key: "approval-requested", version_id: "v1", categories: [] },
    tenant: "org_1",
    ...overrides,
  } as FeedItem;
}

describe("mapFeedItem", () => {
  it("takes the title from the body's first paragraph and links to the Hub", () => {
    expect(mapFeedItem(feedItem())).toEqual({
      id: "msg_1",
      title: "Approval needed: Gold tier",
      body: "Ada asked to enable it in PROD.",
      createdAt: "2026-10-23T12:00:00Z",
      read: false,
      done: false,
      actionKind: "action",
      link: { app: "hub", path: "/organization/approvals?request=wkrq_1&step=wksa_1" },
    });
  });

  it("marks an approval request done once it was interacted with", () => {
    const item = mapFeedItem(
      feedItem({ interacted_at: "2026-10-23T13:00:00Z", read_at: "2026-10-23T12:30:00Z" })
    );
    expect(item.done).toBe(true);
    expect(item.read).toBe(true);
  });

  it("treats other workflows as information, never done, linking to the Dashboard", () => {
    const item = mapFeedItem(
      feedItem({
        source: { key: "api-key-created", version_id: "v1", categories: [] },
        interacted_at: "2026-10-23T13:00:00Z",
        data: { dashboardPath: "/developers/api-keys" },
      } as Partial<FeedItem>)
    );
    expect(item.actionKind).toBe("info");
    expect(item.done).toBe(false);
    expect(item.link).toEqual({ app: "dashboard", path: "/developers/api-keys" });
  });

  it("keeps codes and symbols that are not markdown", () => {
    const item = mapFeedItem(
      feedItem({
        blocks: [
          {
            name: "body",
            type: "markdown",
            content:
              "**Approval needed: SUMMER_PROMO_2026**\n\nOrder #123 needs points > 100 in `PROD`.",
            rendered: "",
          },
        ],
      })
    );
    expect(item.title).toBe("Approval needed: SUMMER_PROMO_2026");
    expect(item.body).toBe("Order #123 needs points > 100 in PROD.");
  });

  it("prefers a title block and ignores links that are not app paths", () => {
    const item = mapFeedItem(
      feedItem({
        blocks: [
          { name: "title", type: "text", content: "Export failed: nightly", rendered: "" },
          {
            name: "body",
            type: "markdown",
            content: "See [the run](https://x.test).",
            rendered: "",
          },
        ],
        data: { hubPath: "https://evil.test/phish" },
      })
    );
    expect(item.title).toBe("Export failed: nightly");
    expect(item.body).toBe("See the run.");
    expect(item.link).toBeUndefined();
  });

  it("shows the rendered text, not the template's variables", () => {
    const item = mapFeedItem(
      feedItem({
        blocks: [
          {
            name: "body",
            type: "markdown",
            content:
              "**API key created**\n\n{{ data.actorDisplayName }} created {{ data.keyName }}.",
            rendered:
              "<p><strong>API key created</strong></p>\n<p>Ada created *Smoke* &amp; test_key &lt;1&gt;.</p>",
          },
        ],
      })
    );
    expect(item.title).toBe("API key created");
    expect(item.body).toBe("Ada created *Smoke* & test_key <1>.");
  });

  it("uses a text block's rendered value", () => {
    const item = mapFeedItem(
      feedItem({
        blocks: [
          {
            name: "title",
            type: "text",
            content: "Export failed: {{ data.name }}",
            rendered: "Export failed: nightly",
          },
          {
            name: "body",
            type: "markdown",
            content: "Run {{ data.run }}",
            rendered: "<p>Run 42</p>",
          },
        ],
      })
    );
    expect(item.title).toBe("Export failed: nightly");
    expect(item.body).toBe("Run 42");
  });
});
