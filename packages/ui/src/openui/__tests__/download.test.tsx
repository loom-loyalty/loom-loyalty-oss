import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock @openuidev/react-lang — defineOpenUIComponent calls defineComponent at
// import time, so we need a stub before importing Download.
vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useTriggerAction: () => vi.fn(),
}));

import { Download } from "../components/feedback/download";
import { OpenUIRuntimeProvider } from "../runtime-context";

const renderNode = (value: unknown) => <span>{String(value)}</span>;
const Component = Download.component;

function withRuntime(node: React.ReactNode, getToken?: () => Promise<string>) {
  return (
    <OpenUIRuntimeProvider baseUrl="https://api.test" getToken={getToken}>
      {node}
    </OpenUIRuntimeProvider>
  );
}

describe("Download", () => {
  // jsdom doesn't ship URL.createObjectURL / revokeObjectURL by default. Patch
  // them on the real URL constructor (don't replace the constructor itself —
  // the component uses `new URL()` for allowlist validation, which needs the
  // real WHATWG parser intact).
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("renders the download button with aria-label including the format extension", () => {
    render(
      withRuntime(
        <Component
          props={{
            label: "Download as Markdown",
            url: "/api/ai/templates/render?programCode=coffee&format=md",
            filename: "coffee",
            format: "md",
          }}
          renderNode={renderNode}
        />
      )
    );
    expect(screen.getByRole("button", { name: "Download coffee.md" })).toBeInTheDocument();
    expect(screen.getByText("Download as Markdown")).toBeInTheDocument();
  });

  it("blocks downloads to URLs outside the allowed template endpoints", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      withRuntime(
        <Component
          props={{
            label: "Sketchy",
            url: "/api/random-evil-endpoint",
            filename: "evil",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        async () => "token"
      )
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not an allowed templates endpoint/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks path-traversal bypass — `..` segments normalise to a different endpoint", async () => {
    // Critical: the WHATWG URL parser collapses `..` segments before fetch
    // dispatches. A naive `startsWith` allowlist would let
    // `/api/ai/templates/render/../../threads/x` through; the actual
    // request would land on `/api/ai/threads/x` with the user's bearer JWT.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      withRuntime(
        <Component
          props={{
            label: "Traversal",
            url: "/api/ai/templates/render/../../threads/abc/messages",
            filename: "evil",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        async () => "token"
      )
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not an allowed templates endpoint/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks prefix-boundary bypass — `/api/ai/templates/render-batch` is not `/api/ai/templates/render`", async () => {
    // A naive startsWith allowlist would accept this URL even though
    // `/api/ai/templates/render-batch` is a different (hypothetical
    // future) endpoint. Pathname-equality matching catches it.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      withRuntime(
        <Component
          props={{
            label: "Boundary",
            url: "/api/ai/templates/render-batch?programCode=x&format=md",
            filename: "boundary",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        async () => "token"
      )
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not an allowed templates endpoint/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks absolute URLs — agent cannot redirect the fetch to a foreign host", async () => {
    // If the agent emits `https://attacker.example/api/ai/templates/render`,
    // the URL parser resolves to a non-placeholder origin and the guard
    // rejects. Without this, the user's bearer JWT could be shipped to
    // any host the agent picks.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      withRuntime(
        <Component
          props={{
            label: "Foreign host",
            url: "https://attacker.example/api/ai/templates/render?programCode=x&format=md",
            filename: "foreign",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        async () => "token"
      )
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not an allowed templates endpoint/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches with Bearer token, baseUrl prefix, and triggers a blob save", async () => {
    const blob = new Blob(["# program md content"], { type: "text/markdown" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokenFn = vi.fn().mockResolvedValue("jwt-abc");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      withRuntime(
        <Component
          props={{
            label: "Download",
            url: "/api/ai/templates/render?programCode=coffee&format=md",
            filename: "coffee",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        tokenFn
      )
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/api/ai/templates/render?programCode=coffee&format=md",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer jwt-abc" }),
        })
      );
    });
    expect(tokenFn).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalled();
    // No error banner should show on the happy path.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    clickSpy.mockRestore();
  });

  it("surfaces an inline error when the server returns non-2xx with a JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Program not found" }),
      })
    );

    render(
      withRuntime(
        <Component
          props={{
            label: "Download",
            url: "/api/ai/templates/render?programCode=missing&format=md",
            filename: "missing",
            format: "md",
          }}
          renderNode={renderNode}
        />,
        async () => "jwt"
      )
    );

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Program not found");
    });
  });

  it("falls back gracefully when no runtime context is present", async () => {
    // Render without OpenUIRuntimeProvider — useOpenUIRuntime() returns null
    // and the component should refuse to fetch rather than blow up.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <Component
        props={{
          label: "Download",
          url: "/api/ai/templates/render?programCode=coffee&format=md",
          filename: "coffee",
          format: "md",
        }}
        renderNode={renderNode}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not available/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
