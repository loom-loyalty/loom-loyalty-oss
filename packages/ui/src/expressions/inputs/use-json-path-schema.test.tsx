import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { DataModelLike } from "../expression-context";
import { ExpressionContextProvider } from "../expression-context";
import { useJsonPathSchema } from "./use-json-path-schema";

// A small event schema: ORDER_PLACED.customer (-> CUSTOMER_INFO) .address
// (-> ADDRESS_INFO) .zipCode (STRING). CUSTOMER_INFO/ADDRESS_INFO are
// deliberately distinct from the hook's own auto-fetched "customer" model code
// so resolving a path through them genuinely requires an on-demand
// `expandNodeAsync` fetch — matching AE3's "never navigated via the picker"
// scenario, not a value already warmed by the hook's built-in target-model load.
const MODELS: Record<string, DataModelLike> = {
  ORDER_PLACED: {
    elements: [
      { outputAttribute: "customer", name: "Customer", typeReference: "CUSTOMER_INFO" },
      { outputAttribute: "total", name: "Total", typeReference: "NUMBER" },
      { outputAttribute: "tags", name: "Tags", typeReference: "STRING", array: true },
    ],
  },
  CUSTOMER_INFO: {
    elements: [{ outputAttribute: "address", name: "Address", typeReference: "ADDRESS_INFO" }],
  },
  ADDRESS_INFO: {
    elements: [{ outputAttribute: "zipCode", name: "ZIP Code", typeReference: "STRING" }],
  },
  CUSTOMER: { elements: [] },
  // Inheritance fixtures: PURCHASE_CHILD extends TRANSACTION_PARENT (mirrors
  // caferewards-purchase extending transaction, confirmed live -- a by-code
  // fetch only ever returns a type's own direct elements, and eligibleAmount
  // is only resolvable at all once the parent's elements get merged in).
  // "transactionId" exists on BOTH, with a different `name`, to test that the
  // child's own element wins on a name collision rather than the parent's.
  PURCHASE_CHILD: {
    elements: [
      { outputAttribute: "amount", name: "Amount", typeReference: "NUMBER" },
      { outputAttribute: "transactionId", name: "Child Transaction Id", typeReference: "STRING" },
    ],
    parentTypeReference: "TRANSACTION_PARENT",
  },
  TRANSACTION_PARENT: {
    elements: [
      {
        outputAttribute: "eligibleAmount",
        name: "Eligible Amount",
        typeReference: "FIAT_CURRENCY",
      },
      {
        outputAttribute: "transactionId",
        name: "Parent Transaction Id",
        typeReference: "STRING",
      },
    ],
  },
  FIAT_CURRENCY: {
    elements: [
      { outputAttribute: "amount", name: "Amount", typeReference: "NUMBER" },
      { outputAttribute: "currencyTypeCode", name: "Currency Type Code", typeReference: "STRING" },
    ],
  },
  // A malformed/circular parent chain (A -> B -> A) must not hang forever.
  CYCLE_A: {
    elements: [{ outputAttribute: "ownFieldA", name: "Own Field A", typeReference: "STRING" }],
    parentTypeReference: "CYCLE_B",
  },
  CYCLE_B: {
    elements: [{ outputAttribute: "ownFieldB", name: "Own Field B", typeReference: "STRING" }],
    parentTypeReference: "CYCLE_A",
  },
};

function makeFetchDataModel(overrides?: Record<string, () => Promise<DataModelLike>>) {
  return vi.fn((code: string) => {
    const upper = code.toUpperCase();
    if (overrides?.[upper]) return overrides[upper]!();
    const model = MODELS[upper];
    if (!model) return Promise.reject(new Error(`Unknown model ${upper}`));
    return Promise.resolve(model);
  });
}

function wrapper(fetchDataModel: (code: string) => Promise<DataModelLike>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ExpressionContextProvider
        dataModelCode="ORDER_PLACED"
        mode="event"
        fetchDataModel={fetchDataModel}
      >
        {children}
      </ExpressionContextProvider>
    );
  };
}

describe("useJsonPathSchema — resolvePath (R8/KTD8)", () => {
  it("resolves a deep path whose intermediate segments were never navigated via the picker (AE3)", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });

    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.customer.address.zipCode");
    });

    expect(resolution).toMatchObject({
      status: "valid",
      typeReference: "STRING",
      breadcrumbs: [
        { name: "Event Data" },
        { name: "Customer" },
        { name: "Address" },
        { name: "ZIP Code", typeReference: "STRING" },
      ],
    });
  });

  it("reports invalid-prefix immediately for a path missing the $. prefix", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    const resolution = await result.current.resolvePath("zipCode");
    expect(resolution).toEqual({ status: "invalid-prefix" });
  });

  it("reports unresolved for a segment that genuinely doesn't exist", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.bogus.field");
    });
    expect(resolution).toMatchObject({ status: "unresolved" });
  });

  it("reports load-failure (not a genuine unresolved error) when a segment fetch rejects", async () => {
    const fetchDataModel = makeFetchDataModel({
      ADDRESS_INFO: () => Promise.reject(new Error("network down")),
    });
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.customer.address.zipCode");
    });
    expect(resolution).toEqual({ status: "load-failure" });
  });

  it("reports schema-unavailable (never blocking) when no data model code has resolved", async () => {
    const fetchDataModel = makeFetchDataModel();
    function NoCodeWrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider mode="event" fetchDataModel={fetchDataModel}>
          {children}
        </ExpressionContextProvider>
      );
    }
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: NoCodeWrapper });

    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.customer.address.zipCode");
    });
    expect(resolution).toEqual({ status: "schema-unavailable" });
  });

  it("reports pending (never blocking) while the root schema fetch is still in flight", async () => {
    let releaseFetch: (() => void) | undefined;
    const fetchDataModel = vi.fn(
      (code: string) =>
        new Promise<DataModelLike>((resolve) => {
          releaseFetch = () => resolve(MODELS[code.toUpperCase()]!);
        })
    );
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });

    // Root fetch is in flight; nothing has resolved yet.
    const resolution = await result.current.resolvePath("$.eventData.total");
    expect(resolution).toEqual({ status: "pending" });

    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
    });
  });

  it("reports load-failure (not unresolved) when the ROOT event-data fetch itself rejects", async () => {
    const fetchDataModel = makeFetchDataModel({
      ORDER_PLACED: () => Promise.reject(new Error("network down")),
    });
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    const resolution = await result.current.resolvePath("$.eventData.total");
    expect(resolution).toEqual({ status: "load-failure" });
  });

  it("reports unresolved when array-index syntax doesn't match the field's actual shape", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    // "total" is a scalar NUMBER field — array-index syntax on it is a shape mismatch.
    const scalarWithBrackets = await result.current.resolvePath("$.eventData.total[*]");
    expect(scalarWithBrackets).toMatchObject({ status: "unresolved" });

    // "tags" is an array field — accessing it WITHOUT brackets is also a mismatch.
    const arrayWithoutBrackets = await result.current.resolvePath("$.eventData.tags");
    expect(arrayWithoutBrackets).toMatchObject({ status: "unresolved" });

    // The correctly-bracketed array access resolves as valid.
    let validArrayAccess;
    await act(async () => {
      validArrayAccess = await result.current.resolvePath("$.eventData.tags[*]");
    });
    expect(validArrayAccess).toMatchObject({ status: "valid", isArray: true });
  });

  it("shares one fetch/cache path between expandNode and expandNodeAsync (KTD8 — no duplicate fetch)", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: wrapper(fetchDataModel) });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    const callsBefore = fetchDataModel.mock.calls.filter((c) => c[0] === "CUSTOMER_INFO").length;
    await act(async () => {
      await result.current.expandNodeAsync("eventData", ["customer"], "CUSTOMER_INFO", 1);
    });
    // Second resolvePath walk over the SAME type must hit the cache, not refetch.
    await act(async () => {
      await result.current.resolvePath("$.eventData.customer.address.zipCode");
    });
    const callsAfter = fetchDataModel.mock.calls.filter((c) => c[0] === "CUSTOMER_INFO").length;
    expect(callsAfter - callsBefore).toBe(1);
  });
});

describe("useJsonPathSchema — data-model type inheritance", () => {
  function purchaseWrapper(fetchDataModel: (code: string) => Promise<DataModelLike>) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="PURCHASE_CHILD"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    };
  }

  it("resolves a field that only exists on the parent type, not the child's own elements", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), {
      wrapper: purchaseWrapper(fetchDataModel),
    });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.eligibleAmount.amount");
    });

    expect(resolution).toMatchObject({
      status: "valid",
      typeReference: "NUMBER",
      breadcrumbs: [
        { name: "Event Data" },
        { name: "Eligible Amount", typeReference: "FIAT_CURRENCY" },
        { name: "Amount", typeReference: "NUMBER" },
      ],
    });
  });

  it("includes both the type's own fields and its inherited fields in the browse tree", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), {
      wrapper: purchaseWrapper(fetchDataModel),
    });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    const attributes = result.current.eventDataNodes.map((n) => n.attribute);
    expect(attributes).toContain("amount"); // own
    expect(attributes).toContain("eligibleAmount"); // inherited from TRANSACTION_PARENT
  });

  it("keeps the child's own field on a name collision, not the inherited one of the same name", async () => {
    const fetchDataModel = makeFetchDataModel();
    const { result } = renderHook(() => useJsonPathSchema(), {
      wrapper: purchaseWrapper(fetchDataModel),
    });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    const transactionIdNodes = result.current.eventDataNodes.filter(
      (n) => n.attribute === "transactionId"
    );
    // Exactly one node for the colliding attribute — the parent's copy must
    // not also appear as a second, shadowed entry.
    expect(transactionIdNodes).toHaveLength(1);
    expect(transactionIdNodes[0]).toMatchObject({ name: "Child Transaction Id" });
  });

  it("does not hang on a malformed/circular parent chain", async () => {
    const fetchDataModel = makeFetchDataModel();
    function CycleWrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="CYCLE_A"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    }
    const { result } = renderHook(() => useJsonPathSchema(), { wrapper: CycleWrapper });
    await waitFor(() => expect(result.current.eventDataNodes.length).toBeGreaterThan(0));

    // Resolving must settle (not hang forever) and still find the type's own field.
    let resolution;
    await act(async () => {
      resolution = await result.current.resolvePath("$.eventData.ownFieldA");
    });
    expect(resolution).toMatchObject({ status: "valid" });
  });
});
