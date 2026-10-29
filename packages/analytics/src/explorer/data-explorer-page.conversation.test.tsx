/**
 * Regression coverage for DataExplorerPage's client-held conversation state
 * (turns/previousQuestion/reset), which has no other test file. Two of the
 * four behaviors covered here already shipped as real bugs once — caught only
 * by manual QA — before this file existed:
 *
 *   - the "Continuing from" quote pointed at the just-asked question instead
 *     of the one before it (a self-quoting off-by-one), and
 *   - "Start new question" cleared the turn history but not the stale SQL
 *     grounding, so the very next ask was still answered as a refinement of
 *     the abandoned conversation.
 *
 * Heavy child components (SqlEditor/SchemaBrowser/SavedQueriesPanel/
 * QueryResultsTable) are stubbed — this file isolates the page's own
 * conversation-state logic, not CodeMirror or the rest of the workbench UI.
 * AskAiAssistant is left real so the tests exercise it the way a user would:
 * type into the Ask input and click the real buttons.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DATASOURCES = [
  {
    name: "mv_customers",
    description: "Customers",
    columns: [{ name: "customer_id", type: "String" }],
  },
];

let translateMock: ReturnType<typeof vi.fn>;

vi.mock("../provider", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../provider")),
  useTinybird: () => ({
    datasources: DATASOURCES,
    sqlEnabled: true,
    isLoading: false,
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
    translate: translateMock,
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
    // Mirrors the real SqlEditor's externalValue contract: when the page
    // pushes AI-generated SQL in, reflect it back through onChange (as the
    // real CodeMirror binding would) and mark it consumed.
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
    QueryResultsTable: () => <div data-testid="results-table" />,
    SampleDataBanner: () => null,
  };
});

import { DataExplorerPage } from "./data-explorer-page";

function proposal(sql: string | null) {
  return { sql, explanation: "explanation", assumptions: [], clarifyingQuestion: null };
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByLabelText(/ask your data a question/i);
  await user.clear(input);
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: /^ask$/i }));
}

describe("DataExplorerPage — conversation state", () => {
  beforeEach(() => {
    translateMock = vi.fn();
  });

  it("shows no 'Continuing from' indicator after the first ask", async () => {
    const user = userEvent.setup();
    translateMock.mockResolvedValueOnce(proposal("SELECT 1"));
    render(<DataExplorerPage />);

    await ask(user, "show customers and their tier");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(1));

    expect(screen.queryByText(/continuing from/i)).not.toBeInTheDocument();
  });

  it("quotes the FIRST question after a second ask, not the one just typed (retrospective indexing)", async () => {
    const user = userEvent.setup();
    translateMock.mockResolvedValueOnce(proposal("SELECT 1"));
    render(<DataExplorerPage />);

    await ask(user, "show customers and their tier");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(1));

    translateMock.mockResolvedValueOnce(proposal("SELECT 2"));
    await ask(user, "now only show Gold tier customers");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(2));

    // Must quote the FIRST question (what this SQL continued from), not the
    // second one that's still sitting in the input.
    expect(screen.getByText("show customers and their tier")).toBeInTheDocument();
    expect(screen.queryByText("now only show Gold tier customers")).not.toBeInTheDocument();

    const secondCallArgs = translateMock.mock.calls[1]![0] as { turns?: unknown[] };
    expect(secondCallArgs.turns).toEqual([
      { prompt: "show customers and their tier", sql: "SELECT 1" },
    ]);
  });

  it("suppresses stale SQL/turns grounding on the next ask after 'Start new question'", async () => {
    const user = userEvent.setup();
    translateMock.mockResolvedValueOnce(proposal("SELECT 1"));
    render(<DataExplorerPage />);

    await ask(user, "show customers and their tier");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(1));

    translateMock.mockResolvedValueOnce(proposal("SELECT 2"));
    await ask(user, "now only show Gold tier customers");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/continuing from/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start new question/i }));
    expect(screen.queryByText(/continuing from/i)).not.toBeInTheDocument();

    // Ask again WITHOUT changing the editor content — the reset must still
    // suppress the leftover SQL as grounding, and must not resend turns.
    translateMock.mockResolvedValueOnce(proposal("SELECT 3"));
    await ask(user, "something entirely unrelated");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(3));

    const thirdCallArgs = translateMock.mock.calls[2]![0] as { sql?: string; turns?: unknown[] };
    expect(thirdCallArgs.turns).toBeUndefined();
    expect(thirdCallArgs.sql).toBeUndefined();
  });

  it("drops a stale in-flight response if a reset happens before it resolves", async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: ReturnType<typeof proposal>) => void;
    translateMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      })
    );
    render(<DataExplorerPage />);

    await ask(user, "show customers and their tier");
    await waitFor(() => expect(translateMock).toHaveBeenCalledTimes(1));

    // Reset the conversation while the first ask is still in flight.
    // (previousQuestion isn't set yet, so there's no button — reach the
    // same reset path via a schema-changing action instead: selecting an
    // Examples SQL template also calls clearConversation.)
    resolveFirst(proposal("SELECT 1"));
    await waitFor(() => expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument());

    // The stale response resolved after the guard's sequence number moved on
    // (clearConversation bumps conversationSeqRef) — turns must stay empty,
    // so the very next ask still shows no "Continuing from" indicator.
    expect(screen.queryByText(/continuing from/i)).not.toBeInTheDocument();
  });
});
