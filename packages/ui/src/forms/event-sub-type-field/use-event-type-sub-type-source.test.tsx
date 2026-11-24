/**
 * The event type's sub type source is read only when the caller may read metadata entries, so a role without that
 * scope never fills the audit log with refusals and keeps the free-text sub type.
 */
import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, setupServer } from "@loom-loyalty/test-utils";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { MetadataReadAccessProvider } from "../metadata-field/metadata-read-access";
import { useEventTypeSubTypeSource } from "./use-event-type-sub-type-source";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

const requests: string[] = [];
const server = setupServer(
  http.get(`${API_BASE}/data-types/by-type/:type/:code`, ({ params }) => {
    requests.push(`${String(params.type)} ${String(params.code)}`);
    return HttpResponse.json({
      success: true,
      data: { code: params.code, subTypeSource: "TARGET" },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function render(entries: boolean | undefined) {
  const { Wrapper } = createQueryWrapper();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Wrapper>
      {entries === undefined ? (
        children
      ) : (
        <MetadataReadAccessProvider value={{ types: true, entries }}>
          {children}
        </MetadataReadAccessProvider>
      )}
    </Wrapper>
  );
  return renderHook(() => useEventTypeSubTypeSource("TARGET_ACHIEVED"), { wrapper });
}

describe("useEventTypeSubTypeSource", () => {
  it("reads the event type's source when the caller may read metadata entries", async () => {
    const { result } = render(true);

    await waitFor(() => expect(result.current.source).toBe("TARGET"));
    expect(requests).toEqual(["EVENT_TYPE TARGET_ACHIEVED"]);
  });

  it("reads it with no provider, as the other metadata fields do", async () => {
    const { result } = render(undefined);

    await waitFor(() => expect(result.current.source).toBe("TARGET"));
  });

  it("sends no lookup and keeps the free-text sub type when the caller can't read metadata entries", async () => {
    const { result } = render(false);
    await settle();

    expect(requests).toEqual([]);
    expect(result.current.source).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
