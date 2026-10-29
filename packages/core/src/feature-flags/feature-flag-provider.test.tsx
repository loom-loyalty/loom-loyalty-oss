import { OpenFeature } from "@openfeature/react-sdk";
import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagProvider } from "./feature-flag-provider";
import { useFeatureFlag } from "./hooks";

function Probe({ flag = "channel-incentives" }: { flag?: string }) {
  const on = useFeatureFlag(flag, false);
  return <span data-testid="flag">{on ? "on" : "off"}</span>;
}

function requestAt(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, index: number): Request {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`no fetch call at index ${index}`);
  const [input, init] = call;
  return input instanceof Request ? input : new Request(input, init);
}

function bulkResponse(value: boolean) {
  return new Response(
    JSON.stringify({
      flags: [
        { key: "channel-incentives", value, reason: "TARGETING_MATCH", variant: String(value) },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("FeatureFlagProvider", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await OpenFeature.clearProviders();
    vi.unstubAllGlobals();
  });

  it("posts to the OFREP bulk URL with the bearer from the token provider", async () => {
    fetchMock.mockResolvedValue(bulkResponse(true));

    render(
      <FeatureFlagProvider
        baseUrl="https://api.test/api/v1"
        tokenProvider={() => "tok-1"}
        pollInterval={0}
      >
        <Probe />
      </FeatureFlagProvider>
    );

    await waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
    const request = requestAt(fetchMock, 0);
    expect(request.url).toBe("https://api.test/api/v1/ofrep/v1/evaluate/flags");
    expect(request.method).toBe("POST");
    expect(request.headers.get("Authorization")).toBe("Bearer tok-1");
  });

  it("sends no Authorization header without a token provider", async () => {
    fetchMock.mockResolvedValue(bulkResponse(true));

    render(
      <FeatureFlagProvider baseUrl="/api/v1" pollInterval={0} domain="no-token">
        <Probe />
      </FeatureFlagProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = requestAt(fetchMock, 0);
    expect(request.url).toBe(`${window.location.origin}/api/v1/ofrep/v1/evaluate/flags`);
    expect(request.headers.has("Authorization")).toBe(false);
  });

  it("returns the hook default when the fetch fails, without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));

    render(
      <FeatureFlagProvider baseUrl="/api/v1" pollInterval={0} domain="failing">
        <Probe />
      </FeatureFlagProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId("flag").textContent).toBe("off");
  });

  it("sends no Authorization header when the token provider returns null", async () => {
    fetchMock.mockResolvedValue(bulkResponse(true));

    render(
      <FeatureFlagProvider
        baseUrl="/api/v1"
        tokenProvider={() => null}
        pollInterval={0}
        domain="null-token"
      >
        <Probe />
      </FeatureFlagProvider>
    );

    await waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
    expect(requestAt(fetchMock, 0).headers.has("Authorization")).toBe(false);
  });

  it("loads flags under StrictMode's double effect run", async () => {
    fetchMock.mockResolvedValue(bulkResponse(true));

    render(
      <StrictMode>
        <FeatureFlagProvider
          baseUrl="/api/v1"
          targetingKey="env-1"
          pollInterval={0}
          domain="strict"
        >
          <Probe />
        </FeatureFlagProvider>
      </StrictMode>
    );

    await waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
  });

  it("polls for updates and stops polling on unmount", async () => {
    // Only intervals are faked; vi.waitFor keeps real timers (RTL's waitFor polls on setInterval).
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    fetchMock
      .mockResolvedValueOnce(bulkResponse(false))
      .mockResolvedValueOnce(bulkResponse(true))
      .mockResolvedValue(bulkResponse(true));

    const { unmount } = render(
      <FeatureFlagProvider baseUrl="/api/v1" pollInterval={1_000} domain="polling">
        <Probe />
      </FeatureFlagProvider>
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("flag").textContent).toBe("off");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await vi.waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not re-evaluate on a new token provider identity, but uses the latest token", async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse(false)).mockResolvedValueOnce(bulkResponse(true));

    const { rerender } = render(
      <FeatureFlagProvider
        baseUrl="/api/v1"
        tokenProvider={() => "tok-a"}
        targetingKey="env-1"
        pollInterval={0}
        domain="rotate"
      >
        <Probe />
      </FeatureFlagProvider>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestAt(fetchMock, 0).headers.get("Authorization")).toBe("Bearer tok-a");

    await act(async () => {
      rerender(
        <FeatureFlagProvider
          baseUrl="/api/v1"
          tokenProvider={() => "tok-b"}
          targetingKey="env-1"
          pollInterval={0}
          domain="rotate"
        >
          <Probe />
        </FeatureFlagProvider>
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(
        <FeatureFlagProvider
          baseUrl="/api/v1"
          tokenProvider={() => "tok-b"}
          targetingKey="env-2"
          pollInterval={0}
          domain="rotate"
        >
          <Probe />
        </FeatureFlagProvider>
      );
    });

    await waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestAt(fetchMock, 1).headers.get("Authorization")).toBe("Bearer tok-b");
  });

  it("re-evaluates flags when the targeting key changes", async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse(false)).mockResolvedValueOnce(bulkResponse(true));

    const { rerender } = render(
      <FeatureFlagProvider baseUrl="/api/v1" targetingKey="env-1" pollInterval={0} domain="switch">
        <Probe />
      </FeatureFlagProvider>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender(
        <FeatureFlagProvider
          baseUrl="/api/v1"
          targetingKey="env-2"
          pollInterval={0}
          domain="switch"
        >
          <Probe />
        </FeatureFlagProvider>
      );
    });

    await waitFor(() => expect(screen.getByTestId("flag").textContent).toBe("on"));
    const body = (await requestAt(fetchMock, 1).json()) as { context: { targetingKey: string } };
    expect(body.context.targetingKey).toBe("env-2");
  });
});
