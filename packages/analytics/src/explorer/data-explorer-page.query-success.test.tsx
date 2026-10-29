/**
 * Coverage for `onQuerySuccess`, which Hub uses to report the onboarding
 * "Run a query" step (fe#1398). It must fire for a real result with rows and
 * never for an empty result or for sample data.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: Record<string, unknown>[]; meta: { name: string; type: string }[] } | null;

let sqlEnabled: boolean;
let result: Result;

vi.mock("../provider", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../provider")),
  useTinybird: () => ({
    datasources: [],
    sqlEnabled,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../hooks", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../hooks")),
  useSqlQuery: () => ({
    data: result,
    isLoading: false,
    isExporting: false,
    error: null,
    executedSql: result ? "SELECT 1" : null,
    runQuery: vi.fn(),
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

vi.mock("@loom-loyalty/ui/analytics", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@loom-loyalty/ui/analytics");
  return {
    ...actual,
    SqlEditor: () => <div data-testid="sql-editor" />,
    SchemaBrowser: () => <div data-testid="schema-browser" />,
    SavedQueriesPanel: () => <div data-testid="saved-queries-panel" />,
    ResultVisualization: () => <div data-testid="result-visualization" />,
    SampleDataBanner: () => null,
  };
});

import { DataExplorerPage } from "./data-explorer-page";

function rows(count: number): NonNullable<Result> {
  return {
    data: Array.from({ length: count }, (_, i) => ({ n: i })),
    meta: [{ name: "n", type: "UInt32" }],
  };
}

describe("DataExplorerPage — onQuerySuccess", () => {
  beforeEach(() => {
    sqlEnabled = true;
    result = null;
  });

  it("fires once for each real result with rows", () => {
    const onQuerySuccess = vi.fn();
    const { rerender } = render(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    expect(onQuerySuccess).not.toHaveBeenCalled();

    result = rows(3);
    rerender(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    expect(onQuerySuccess).toHaveBeenCalledTimes(1);

    // A re-render with the same result is not another run.
    rerender(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    expect(onQuerySuccess).toHaveBeenCalledTimes(1);

    result = rows(1);
    rerender(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    expect(onQuerySuccess).toHaveBeenCalledTimes(2);
  });

  it("does not fire for an empty result", () => {
    const onQuerySuccess = vi.fn();
    result = rows(0);
    render(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    expect(onQuerySuccess).not.toHaveBeenCalled();
  });

  it("does not fire for sample data", () => {
    const onQuerySuccess = vi.fn();
    sqlEnabled = false;
    render(<DataExplorerPage onQuerySuccess={onQuerySuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /view sample data/i }));
    expect(onQuerySuccess).not.toHaveBeenCalled();
  });
});
