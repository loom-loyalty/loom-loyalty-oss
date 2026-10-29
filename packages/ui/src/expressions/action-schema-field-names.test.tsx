import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import { useActionSchemaFieldNames } from "./action-schema-field-names";
import { ExpressionContextProvider, type DataModelLike } from "./expression-context";
import type { ExpressionAction } from "./types";

const MODELS: Record<string, DataModelLike> = {
  ORDER_PLACED: {
    elements: [
      { outputAttribute: "total", name: "Order total", typeReference: "DECIMAL" },
      { outputAttribute: "order", name: "Order", typeReference: "ORDER" },
    ],
  },
  ORDER: {
    elements: [{ outputAttribute: "orderTotal", name: "Order total", typeReference: "DECIMAL" }],
  },
  customer: { elements: [{ outputAttribute: "tier", name: "Tier", typeReference: "STRING" }] },
};

const actions: ExpressionAction[] = [
  {
    issueProgramCurrency: {
      isFixedAmount: false,
      defaultResult: 0,
      path: "$.eventData.total",
      programCurrencyCode: "POINTS",
    },
  },
  {
    withdrawProgramCurrency: {
      isFixedAmount: false,
      defaultResult: 0,
      path: "$.eventData.order.orderTotal",
      programCurrencyCode: "POINTS",
    },
  },
];

describe("useActionSchemaFieldNames", () => {
  it("resolves real schema labels once for the full action band", async () => {
    const fetchDataModel = vi.fn((code: string) => Promise.resolve(MODELS[code]!));
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    }

    const { result } = renderHook(() => useActionSchemaFieldNames(actions), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.fieldName("$.eventData.total")).toBe("Order total");
      expect(result.current.fieldName("$.eventData.order.orderTotal")).toBe("Order total");
    });
    expect(fetchDataModel).toHaveBeenCalledTimes(2);
    expect(fetchDataModel).toHaveBeenCalledWith("ORDER_PLACED");
    expect(fetchDataModel).toHaveBeenCalledWith("ORDER");
  });

  // CUSTOMER_MODEL_CODE (the canonical lowercase "customer") is only reached via an
  // $.eventTarget.* action path in event mode -- previously untested in either
  // direction (code review finding): the casing migration to lowercase passed
  // through unverified since no existing test exercised this branch at all.
  it("resolves an eventTarget action path against the canonical lowercase customer model code", async () => {
    const fetchDataModel = vi.fn((code: string) => Promise.resolve(MODELS[code]!));
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    }
    const eventTargetActions: ExpressionAction[] = [
      {
        issueProgramCurrency: {
          isFixedAmount: false,
          defaultResult: 0,
          path: "$.eventTarget.tier",
          programCurrencyCode: "POINTS",
        },
      },
    ];

    const { result } = renderHook(() => useActionSchemaFieldNames(eventTargetActions), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.fieldName("$.eventTarget.tier")).toBe("Tier");
    });
    expect(fetchDataModel).toHaveBeenCalledWith("customer");
  });

  it("retries a model fetch that failed transiently instead of permanently caching the rejection (adversarial review finding)", async () => {
    const fetchDataModel = vi
      .fn<(code: string) => Promise<DataModelLike>>()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockImplementation((code: string) => Promise.resolve(MODELS[code]!));
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    }

    const singleAction: ExpressionAction[] = [
      {
        issueProgramCurrency: {
          isFixedAmount: false,
          defaultResult: 0,
          path: "$.eventData.total",
          programCurrencyCode: "POINTS",
        },
      },
    ];
    const twoActions: ExpressionAction[] = [
      ...singleAction,
      {
        withdrawProgramCurrency: {
          isFixedAmount: false,
          defaultResult: 0,
          path: "$.eventData.order.orderTotal",
          programCurrencyCode: "POINTS",
        },
      },
    ];

    const { result, rerender } = renderHook(
      ({ currentActions }: { currentActions: ExpressionAction[] }) =>
        useActionSchemaFieldNames(currentActions),
      { wrapper: Wrapper, initialProps: { currentActions: singleAction } }
    );

    // First fetch for ORDER_PLACED rejects — the chip falls back (no name yet).
    await waitFor(() => expect(fetchDataModel).toHaveBeenCalledTimes(1));
    expect(result.current.fieldName("$.eventData.total")).toBeUndefined();

    // The next path-set change that re-runs the resolution effect (here, a
    // second action being added) must retry ORDER_PLACED, not keep replaying
    // the same failed promise forever.
    rerender({ currentActions: twoActions });
    await waitFor(() => {
      expect(result.current.fieldName("$.eventData.total")).toBe("Order total");
    });
    expect(fetchDataModel).toHaveBeenCalledTimes(3);
  });

  it("doesn't re-fetch when `actions` gets a new array reference but the same paths (adversarial review finding)", async () => {
    const fetchDataModel = vi.fn((code: string) => Promise.resolve(MODELS[code]!));
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          {children}
        </ExpressionContextProvider>
      );
    }

    const { result, rerender } = renderHook(
      ({ currentActions }: { currentActions: ExpressionAction[] }) =>
        useActionSchemaFieldNames(currentActions),
      { wrapper: Wrapper, initialProps: { currentActions: actions } }
    );

    await waitFor(() => {
      expect(result.current.fieldName("$.eventData.total")).toBe("Order total");
    });
    expect(fetchDataModel).toHaveBeenCalledTimes(2);
    const settledResult = result.current;

    // A fresh array with identical content (e.g. `actions ?? []` re-evaluating
    // on every parent render) must not re-trigger the resolution effect. Assert
    // via reference stability of the returned object, not just fetch count —
    // `getModel`'s own success cache would otherwise mask an unnecessary
    // effect re-run (same resolved names, but a fresh Map/object each time).
    rerender({ currentActions: [...actions] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(settledResult);
    expect(fetchDataModel).toHaveBeenCalledTimes(2);
  });
});
