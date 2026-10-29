/**
 * Coverage for the chart → Spindle hand-off.
 *
 * The behavior that matters here is the branch: a drill-down whose spec the
 * live schema supports must land as SQL and run immediately, while one it does
 * not support must land as a question the user reviews rather than as SQL
 * against a table they cannot query. Both paths are exercised against the real
 * registry and resolver, so a spec that drifts away from its declared
 * requirements fails here.
 *
 * Heavy children (SqlEditor/SchemaBrowser/SavedQueriesPanel/ResultVisualization)
 * are stubbed; AskAiAssistant stays real so the prefilled question is asserted
 * where the user would actually read it.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DrilldownTarget } from "../drilldown";
import { PIPES } from "../pipes";

/** Satisfies the Tier Distribution spec; nothing else in the registry. */
const TIER_SCHEMA = [
  {
    name: "customer_tier_issued",
    description: "Tier assignment events",
    columns: [
      { name: "customer_entity_id", type: "String" },
      { name: "tier_code", type: "String" },
      { name: "tier_name", type: "String" },
      { name: "tier_rank", type: "Int32" },
      { name: "event_datetime", type: "DateTime64" },
      { name: "cancelled", type: "UInt8" },
    ],
  },
];

let runQueryMock: ReturnType<typeof vi.fn>;
let datasources: typeof TIER_SCHEMA;
let tokenLoading: boolean;

vi.mock("../provider", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../provider")),
  useTinybird: () => ({
    datasources,
    sqlEnabled: true,
    isLoading: tokenLoading,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../hooks", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../hooks")),
  useSqlQuery: () => ({
    data: null,
    isLoading: false,
    isExporting: false,
    error: null,
    executedSql: null,
    runQuery: runQueryMock,
    exportCsv: vi.fn(),
  }),
  useSavedQueries: () => ({
    queries: [],
    save: vi.fn(),
    remove: vi.fn(),
    toggleFavorite: vi.fn(),
  }),
  useSpindleTranslate: () => ({
    translate: vi.fn(),
    explainResults: vi.fn(),
    isLoading: false,
    error: null,
    explainLoading: false,
    explainError: null,
    reset: vi.fn(),
  }),
}));

let editorSql: string | null = null;

vi.mock("@loom-loyalty/ui/analytics", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@loom-loyalty/ui/analytics");
  return {
    ...actual,
    SqlEditor: ({
      externalValue,
      onChange,
      onExternalValueConsumed,
    }: {
      externalValue: string | null;
      onChange: (value: string) => void;
      onExternalValueConsumed: () => void;
    }) => {
      useEffect(() => {
        if (externalValue !== null) {
          editorSql = externalValue;
          onChange(externalValue);
          onExternalValueConsumed();
        }
        // Intentionally keyed on externalValue alone: the stub mirrors the real
        // editor, which consumes a pushed value once rather than on every
        // identity change of its callbacks.
      }, [externalValue]);
      return <div data-testid="sql-editor" />;
    },
    SchemaBrowser: () => <div data-testid="schema-browser" />,
    SavedQueriesPanel: () => <div data-testid="saved-queries-panel" />,
    ResultVisualization: () => <div data-testid="result-visualization" />,
    SampleDataBanner: () => null,
  };
});

import { DataExplorerPage } from "./data-explorer-page";

const target = (overrides: Partial<DrilldownTarget> = {}): DrilldownTarget => ({
  pipe: PIPES.TIERS_TOTAL,
  level: "chart",
  title: "",
  context: { startDate: "2026-07-27", endDate: "2026-08-26", granularity: "daily" },
  ...overrides,
});

describe("DataExplorerPage — drill-down hand-off", () => {
  beforeEach(() => {
    runQueryMock = vi.fn();
    editorSql = null;
    datasources = TIER_SCHEMA;
    tokenLoading = false;
  });

  it("does nothing without a drill-down", () => {
    render(<DataExplorerPage />);
    expect(runQueryMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/drilled in from/i)).not.toBeInTheDocument();
  });

  it("loads chart-level SQL into the editor and runs it", async () => {
    render(<DataExplorerPage drilldown={target()} />);

    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(1);
    });
    expect(editorSql).toContain("FROM customer_tier_issued");
    expect(editorSql).toContain("toDate('2026-07-27')");
  });

  it("narrows to the clicked item and names it in the banner", async () => {
    render(
      <DataExplorerPage
        drilldown={target({ level: "item", datum: { value: "GOLD", label: "Gold" } })}
      />
    );

    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(1);
    });
    expect(editorSql).toContain("tier_code = 'GOLD'");
    expect(screen.getByText("Tier Distribution — Gold")).toBeInTheDocument();
    expect(screen.getByText(/drilled in from/i)).toBeInTheDocument();
  });

  it("applies a given drill-down only once, not on every render", async () => {
    const drilldown = target();
    const { rerender } = render(<DataExplorerPage drilldown={drilldown} />);
    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(1);
    });

    rerender(<DataExplorerPage drilldown={drilldown} />);
    rerender(<DataExplorerPage drilldown={{ ...drilldown }} />);

    // A re-render with an equivalent target must not re-run the query — a
    // drill-down that re-fired on every render would hammer TinyBird.
    expect(runQueryMock).toHaveBeenCalledTimes(1);
  });

  it("re-applies when the user drills into a different item", async () => {
    const { rerender } = render(
      <DataExplorerPage
        drilldown={target({ level: "item", datum: { value: "GOLD", label: "Gold" } })}
      />
    );
    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DataExplorerPage
        drilldown={target({ level: "item", datum: { value: "SILVER", label: "Silver" } })}
      />
    );

    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(2);
    });
    expect(editorSql).toContain("tier_code = 'SILVER'");
  });

  it("hands over a question instead of SQL when the schema lacks the datasource", async () => {
    datasources = [];
    render(<DataExplorerPage drilldown={target()} />);

    const input = await screen.findByLabelText<HTMLInputElement>(/ask your data a question/i);
    await waitFor(() => {
      expect(input.value).toMatch(/each tier/);
    });
    expect(input.value).toContain("2026-08-26");
    // No SQL is proposed and nothing is executed against a table the caller
    // cannot see.
    expect(runQueryMock).not.toHaveBeenCalled();
    expect(editorSql).toBeNull();
    expect(screen.getByText(/no saved query for/i)).toBeInTheDocument();
  });

  it("does not resolve until the schema has arrived with the token", async () => {
    tokenLoading = true;
    const { rerender } = render(<DataExplorerPage drilldown={target()} />);

    // Resolving now would judge the spec unsupported and fall back to a
    // question that was never needed.
    expect(runQueryMock).not.toHaveBeenCalled();

    tokenLoading = false;
    rerender(<DataExplorerPage drilldown={target()} />);

    await waitFor(() => {
      expect(runQueryMock).toHaveBeenCalledTimes(1);
    });
    expect(editorSql).toContain("FROM customer_tier_issued");
  });

  it("offers a way back to the chart it came from", async () => {
    render(<DataExplorerPage drilldown={target()} />);
    const back = await screen.findByRole("link", { name: /back to analytics/i });
    expect(back).toHaveAttribute("href", "/analytics");
  });
});
