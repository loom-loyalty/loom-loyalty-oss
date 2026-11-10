import "@testing-library/jest-dom/vitest";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

const chat = vi.hoisted(() => ({
  openWithMessage: vi.fn(),
  openThread: vi.fn(),
  aiPanelOpen: false,
}));

vi.mock("../ai-chat-context", () => ({
  useAiChat: () => ({
    aiPanelOpen: chat.aiPanelOpen,
    setAiPanelOpen: vi.fn(),
    aiInitialMessage: undefined,
    aiInitialThreadId: undefined,
    openWithMessage: chat.openWithMessage,
    clearInitialMessage: vi.fn(),
    openThread: chat.openThread,
    clearInitialThread: vi.fn(),
  }),
}));

import { RecentThreads } from "../recent-threads";

const baseUrl = "http://localhost:8787";

const serverThreads = [
  {
    thread_id: "t-newest",
    title: "Coffee stamp card",
    created_at: "2026-11-06T10:00:00Z",
    updated_at: "2026-11-07T12:00:00Z",
  },
  { thread_id: "t-untitled", title: null, created_at: "2026-11-07T09:00:00Z", updated_at: null },
  {
    thread_id: "t-3",
    title: "Weekly analytics",
    created_at: "2026-11-05T10:00:00Z",
    updated_at: "2026-11-06T10:00:00Z",
  },
  {
    thread_id: "t-4",
    title: "Birthday offer",
    created_at: "2026-11-04T10:00:00Z",
    updated_at: "2026-11-05T10:00:00Z",
  },
  {
    thread_id: "t-5",
    title: "Tier rules",
    created_at: "2026-11-03T10:00:00Z",
    updated_at: "2026-11-04T10:00:00Z",
  },
  {
    thread_id: "t-6",
    title: "Oldest",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-02T10:00:00Z",
  },
];

function okList(threads = serverThreads) {
  return Response.json({ threads, next_cursor: null });
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  chat.openThread.mockClear();
  chat.aiPanelOpen = false;
  fetchSpy = vi.spyOn(global, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecentThreads — fetching", () => {
  it("fetches /api/ai/threads?limit=5 once per mount with the bearer token and credentials", async () => {
    fetchSpy.mockImplementation(async () => okList());
    const getToken = vi.fn().mockResolvedValue("jwt");
    render(<RecentThreads baseUrl={baseUrl} getToken={getToken} credentials="include" />);

    await screen.findByRole("list", { name: "Recent conversations" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`${baseUrl}/api/ai/threads?limit=5`);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer jwt" });
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("shows a skeleton while loading, then up to five rows in the order served", async () => {
    let resolve!: (r: Response) => void;
    fetchSpy.mockImplementation(() => new Promise<Response>((r) => (resolve = r)));
    render(<RecentThreads baseUrl={baseUrl} />);

    expect(screen.getByLabelText("Loading recent conversations")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    await act(async () => resolve(okList()));

    const list = await screen.findByRole("list", { name: "Recent conversations" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => within(r).getByRole("button").textContent)).toEqual([
      expect.stringContaining("Coffee stamp card"),
      expect.stringContaining("Untitled"),
      expect.stringContaining("Weekly analytics"),
      expect.stringContaining("Birthday offer"),
      expect.stringContaining("Tier rules"),
    ]);
    expect(screen.queryByText("Oldest")).not.toBeInTheDocument();
    const time = rows[0]!.querySelector("time");
    expect(time).toHaveAttribute("dateTime", "2026-11-07T12:00:00Z");
  });

  it("honours a smaller limit, in the request and the rows", async () => {
    fetchSpy.mockImplementation(async () => okList());
    render(<RecentThreads baseUrl={baseUrl} limit={2} />);

    const list = await screen.findByRole("list", { name: "Recent conversations" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(fetchSpy.mock.calls[0]![0]).toBe(`${baseUrl}/api/ai/threads?limit=2`);
  });

  it("renders nothing when there are no conversations", async () => {
    fetchSpy.mockImplementation(async () => okList([]));
    const { container } = render(<RecentThreads baseUrl={baseUrl} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it.each([
    ["401", async () => new Response("", { status: 401 })],
    ["500", async () => new Response("", { status: 500 })],
    ["network", async () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("shows an inline error with Retry on %s, and Retry refetches", async (_label, failing) => {
    fetchSpy.mockImplementationOnce(failing).mockImplementation(async () => okList());
    const user = userEvent.setup();
    render(<RecentThreads baseUrl={baseUrl} />);

    expect(await screen.findByText("Couldn't load your recent conversations.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Recent conversations" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("list", { name: "Recent conversations" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("refetches when the chat sheet closes, keeping the old rows meanwhile", async () => {
    fetchSpy.mockImplementation(async () => okList());
    const { rerender } = render(<RecentThreads baseUrl={baseUrl} />);
    await screen.findByRole("list", { name: "Recent conversations" });

    chat.aiPanelOpen = true;
    rerender(<RecentThreads baseUrl={baseUrl} />);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    chat.aiPanelOpen = false;
    rerender(<RecentThreads baseUrl={baseUrl} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("list", { name: "Recent conversations" })).toBeVisible();
  });

  it("ignores a stale response that lands after a newer fetch", async () => {
    const resolvers: Array<(r: Response) => void> = [];
    fetchSpy.mockImplementation(() => new Promise<Response>((r) => resolvers.push(r)));
    const { rerender } = render(<RecentThreads baseUrl={baseUrl} />);
    chat.aiPanelOpen = true;
    rerender(<RecentThreads baseUrl={baseUrl} />);
    chat.aiPanelOpen = false;
    rerender(<RecentThreads baseUrl={baseUrl} />);
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => resolvers[1]!(okList([serverThreads[0]!])));
    await act(async () => resolvers[0]!(okList(serverThreads)));

    const list = screen.getByRole("list", { name: "Recent conversations" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("RecentThreads — opening", () => {
  it("clicking a row opens that thread in the sheet", async () => {
    fetchSpy.mockImplementation(async () => okList());
    const user = userEvent.setup();
    render(<RecentThreads baseUrl={baseUrl} />);
    await screen.findByRole("list", { name: "Recent conversations" });

    await user.click(screen.getByRole("button", { name: /Weekly analytics/ }));

    expect(chat.openThread).toHaveBeenCalledTimes(1);
    expect(chat.openThread).toHaveBeenCalledWith("t-3");
  });

  it("rows are 44px targets", async () => {
    fetchSpy.mockImplementation(async () => okList());
    render(<RecentThreads baseUrl={baseUrl} />);
    const list = await screen.findByRole("list", { name: "Recent conversations" });
    for (const button of within(list).getAllByRole("button")) {
      expect(button.className).toMatch(/min-h-11/);
    }
  });
});
