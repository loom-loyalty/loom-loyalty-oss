import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationFeedProvider, useNotificationFeed } from "./notification-feed-provider";
import type { NotificationFeedAdapter } from "./types";

function Probe() {
  const feed = useNotificationFeed();
  return (
    <div>
      <span data-testid="status">{feed.status}</span>
      <span data-testid="unread">{feed.unreadCount}</span>
      <span data-testid="titles">{feed.items.map((item) => item.title).join(",")}</span>
      <button type="button" onClick={() => void feed.markRead("n1")}>
        read
      </button>
      <button type="button" onClick={() => void feed.markAllRead()}>
        all
      </button>
      <button type="button" onClick={() => void feed.archive("n1")}>
        archive
      </button>
    </div>
  );
}

function fakeAdapter(overrides: Partial<NotificationFeedAdapter> = {}): NotificationFeedAdapter {
  return {
    status: "ready",
    items: [
      {
        id: "n1",
        title: "Approval needed",
        createdAt: "2026-10-23T14:00:00Z",
        read: false,
        done: false,
        actionKind: "action",
      },
    ],
    unreadCount: 1,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    markAllSeen: vi.fn(),
    archive: vi.fn(),
    ...overrides,
  };
}

describe("NotificationFeedProvider", () => {
  it("reports disabled with no provider mounted, and its actions do nothing", () => {
    render(<Probe />);

    expect(screen.getByTestId("status").textContent).toBe("disabled");
    expect(screen.getByTestId("unread").textContent).toBe("0");
    expect(() => screen.getByText("read").click()).not.toThrow();
  });

  it("reports disabled when mounted without an adapter", () => {
    render(
      <NotificationFeedProvider adapter={null}>
        <Probe />
      </NotificationFeedProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("disabled");
  });

  it("serves the adapter's items and unread count and forwards its actions", () => {
    const adapter = fakeAdapter();
    render(
      <NotificationFeedProvider adapter={adapter}>
        <Probe />
      </NotificationFeedProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("unread").textContent).toBe("1");
    expect(screen.getByTestId("titles").textContent).toBe("Approval needed");
    screen.getByText("read").click();
    screen.getByText("all").click();
    screen.getByText("archive").click();
    expect(adapter.markRead).toHaveBeenCalledWith("n1");
    expect(adapter.markAllRead).toHaveBeenCalled();
    expect(adapter.archive).toHaveBeenCalledWith("n1");
  });

  it("surfaces an adapter error as the error status", () => {
    render(
      <NotificationFeedProvider adapter={fakeAdapter({ status: "error", items: [] })}>
        <Probe />
      </NotificationFeedProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("error");
  });
});
