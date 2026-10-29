import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const knock = vi.hoisted(() => {
  type Listener = (state: unknown) => void;
  const listeners = new Set<Listener>();
  let state = {
    items: [] as unknown[],
    metadata: { total_count: 0, unread_count: 0, unseen_count: 0 },
    loading: true,
    networkStatus: "loading",
  };
  const feed = {
    store: {
      getState: () => state,
      subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    listenForUpdates: vi.fn(),
    fetch: vi.fn(async () => undefined),
    dispose: vi.fn(),
    markAsRead: vi.fn(async () => undefined),
    markAllAsRead: vi.fn(async () => undefined),
    markAllAsSeen: vi.fn(async () => undefined),
    markAsArchived: vi.fn(async () => undefined),
  };
  const instance = {
    authenticate: vi.fn(),
    teardown: vi.fn(),
    feeds: { initialize: vi.fn(() => feed) },
  };
  return {
    feed,
    instance,
    Knock: vi.fn(() => instance),
    emit(next: Partial<typeof state>) {
      state = { ...state, ...next };
      listeners.forEach((listener) => listener(state));
    },
  };
});

vi.mock("@knocklabs/client", () => ({
  default: knock.Knock,
  NetworkStatus: { loading: "loading", fetchMore: "fetchMore", ready: "ready", error: "error" },
}));

import { useKnockNotificationFeed } from "./use-knock-notification-feed";

const settings = {
  enabled: true,
  provider: "knock",
  publicApiKey: "pk_test",
  feedChannelId: "chan_1",
  recipientId: "user_01ADA",
  tenantId: "org_1",
  userToken: "jwt",
};

const message = {
  id: "msg_1",
  blocks: [{ name: "body", type: "markdown", content: "Hello", rendered: "" }],
  inserted_at: "2026-10-23T12:00:00Z",
  read_at: null,
  interacted_at: null,
  data: null,
  source: { key: "api-key-created" },
};

describe("useKnockNotificationFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a feed from another provider", () => {
    const { result } = renderHook(() =>
      useKnockNotificationFeed({ ...settings, provider: "other" })
    );
    expect(result.current).toBeNull();
    expect(knock.Knock).not.toHaveBeenCalled();
  });

  it("is null while the inbox is off", () => {
    const { result } = renderHook(() => useKnockNotificationFeed({ ...settings, enabled: false }));
    expect(result.current).toBeNull();
    expect(knock.Knock).not.toHaveBeenCalled();
  });

  it("opens the tenant's feed with the user's token and maps its state", async () => {
    const { result, unmount } = renderHook(() => useKnockNotificationFeed(settings));

    expect(knock.Knock).toHaveBeenCalledWith("pk_test");
    expect(knock.instance.authenticate).toHaveBeenCalledWith(
      "user_01ADA",
      "jwt",
      expect.objectContaining({ onUserTokenExpiring: expect.any(Function) })
    );
    expect(knock.instance.feeds.initialize).toHaveBeenCalledWith("chan_1", {
      tenant: "org_1",
      archived: "exclude",
      page_size: 50,
    });
    await waitFor(() => expect(result.current?.status).toBe("loading"));

    act(() =>
      knock.emit({
        items: [message],
        loading: false,
        networkStatus: "ready",
        metadata: { total_count: 1, unread_count: 1, unseen_count: 1 },
      })
    );
    expect(result.current?.status).toBe("ready");
    expect(result.current?.unreadCount).toBe(1);
    expect(result.current?.items[0]).toMatchObject({ id: "msg_1", title: "Hello", read: false });

    await act(async () => {
      await result.current?.markRead("msg_1");
      await result.current?.markAllSeen();
      await result.current?.archive("msg_1");
      await result.current?.markAllRead();
    });
    expect(knock.feed.markAsRead).toHaveBeenCalledWith(message);
    expect(knock.feed.markAllAsSeen).toHaveBeenCalled();
    expect(knock.feed.markAsArchived).toHaveBeenCalledWith(message);
    expect(knock.feed.markAllAsRead).toHaveBeenCalled();

    unmount();
    expect(knock.feed.dispose).toHaveBeenCalled();
    expect(knock.instance.teardown).toHaveBeenCalled();
  });

  it("reports an error when the feed cannot load", async () => {
    const { result } = renderHook(() => useKnockNotificationFeed(settings));
    act(() => knock.emit({ items: [], loading: false, networkStatus: "error" }));
    await waitFor(() => expect(result.current?.status).toBe("error"));
  });
});
