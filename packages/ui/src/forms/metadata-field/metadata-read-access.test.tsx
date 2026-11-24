/**
 * A caller whose role can't read metadata never sends the lookups (Hub brief: no access.denied from Customer Care).
 * The package stays scope-agnostic: the app says what the caller may read, these hooks only honour it.
 */
import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, setupServer } from "@loom-loyalty/test-utils";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useMetadataTypeCategory } from "../metadata-sub-type-fields/use-metadata-sub-type-data";
import { MetadataReadAccessProvider, type MetadataReadAccess } from "./metadata-read-access";
import { useMetadataField } from "./use-metadata-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

const requests: string[] = [];
const server = setupServer(
  http.get(`${API_BASE}/metadata-types/by-code/:code`, ({ params }) => {
    requests.push(`type ${String(params.code)}`);
    const category = params.code === "CURRENCY_TYPE" ? "DATA_TYPE" : "METADATA";
    return HttpResponse.json({ success: true, data: { code: params.code, category } });
  }),
  http.get(`${API_BASE}/data-model-types`, () => {
    requests.push("data-model-types");
    return HttpResponse.json({
      success: true,
      data: { content: [], pageNumber: 0, totalPages: 0, totalSize: 0 },
    });
  }),
  http.get(`${API_BASE}/data-types/by-type/:type`, ({ params }) => {
    requests.push(`data-types ${String(params.type)}`);
    return HttpResponse.json({
      success: true,
      data: { content: [], pageNumber: 0, totalPages: 0, totalSize: 0 },
    });
  }),
  http.get(`${API_BASE}/metadata/by-type/:type`, ({ params }) => {
    requests.push(`entries ${String(params.type)}`);
    return HttpResponse.json({
      success: true,
      data: {
        content: [{ code: "F", name: "Female" }],
        pageNumber: 0,
        totalPages: 1,
        totalSize: 1,
      },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

function render(access: MetadataReadAccess | undefined) {
  const { Wrapper } = createQueryWrapper();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Wrapper>
      {access ? (
        <MetadataReadAccessProvider value={access}>{children}</MetadataReadAccessProvider>
      ) : (
        children
      )}
    </Wrapper>
  );
  return renderHook(() => useMetadataField("GENDER"), { wrapper });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe("metadata read access", () => {
  it("sends no lookup when the caller can't read metadata types", async () => {
    const { result } = render({ types: false, entries: false });
    await settle();

    expect(requests).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.metadataOptions).toEqual([]);
  });

  it("never lists options the caller can't read, even with the type", async () => {
    const { result } = render({ types: true, entries: false });

    await waitFor(() => expect(result.current.category).toBe("METADATA"));
    await settle();

    expect(requests).toEqual(["type GENDER"]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.metadataOptions).toEqual([]);
  });

  it("reads both when the caller may (Customer Care, with this release's grant)", async () => {
    const { result } = render({ types: true, entries: true });

    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(1));
    expect(requests).toEqual(["type GENDER", "entries GENDER"]);
  });

  it("reads both with no provider, as before", async () => {
    const { result } = render(undefined);

    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(1));
    expect(requests).toEqual(["type GENDER", "entries GENDER"]);
  });
});

describe("metadata read access: the metadata form's sub-type lookups", () => {
  it("resolves no category for a caller that can't read metadata types", async () => {
    const { Wrapper } = createQueryWrapper();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Wrapper>
        <MetadataReadAccessProvider value={{ types: false, entries: false }}>
          {children}
        </MetadataReadAccessProvider>
      </Wrapper>
    );
    const { result } = renderHook(() => useMetadataTypeCategory("GENDER"), { wrapper });
    await settle();

    expect(requests).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("metadata read access: data-model types have their own scope", () => {
  it("never lists data-model types for a caller that can read metadata but not data-model types", async () => {
    const { Wrapper } = createQueryWrapper();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Wrapper>
        <MetadataReadAccessProvider value={{ types: true, entries: true, dataModelTypes: false }}>
          {children}
        </MetadataReadAccessProvider>
      </Wrapper>
    );
    const { result } = renderHook(() => useMetadataField("CURRENCY_TYPE"), { wrapper });

    await waitFor(() => expect(result.current.category).toBe("DATA_TYPE"));
    await settle();

    expect(requests).not.toContain("data-model-types");
  });

  it("lists them when the caller may, as before", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("CURRENCY_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.category).toBe("DATA_TYPE"));
    await waitFor(() => expect(requests).toContain("data-model-types"));
  });
});
