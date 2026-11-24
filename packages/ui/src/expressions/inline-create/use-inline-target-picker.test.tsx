import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const targetFieldMock = vi.hoisted(() => ({
  state: {
    targets: [] as Array<Record<string, unknown>>,
    isLoading: false,
    isLoadingAll: false,
    hasLoadAllError: false,
    hasNextPage: false,
    createTarget: vi.fn(),
  },
}));

vi.mock("../../forms/target-field/use-target-field.js", () => ({
  useTargetField: () => ({
    ...targetFieldMock.state,
    isCreating: false,
    findTarget: (id: string) => targetFieldMock.state.targets.find((t) => t.targetId === id),
  }),
}));

// The compact sheet itself is covered by target-form-sheet.compact.test.tsx.
vi.mock("../../entity/features/targets/target-form-sheet.js", () => ({
  TargetFormSheet: ({
    open,
    preset,
    defaultProgramIds,
    defaultTimeZone,
    allTargets,
    onSubmit,
    error,
  }: {
    open: boolean;
    preset: string;
    defaultProgramIds?: string[];
    defaultTimeZone?: string;
    allTargets?: unknown[];
    onSubmit: (data: unknown) => Promise<void>;
    error?: { message: string } | string | null;
  }) =>
    open ? (
      <div
        role="dialog"
        data-preset={preset}
        data-programs={defaultProgramIds?.join(",")}
        data-tz={defaultTimeZone}
        data-all-targets={allTargets?.length ?? 0}
      >
        <button
          onClick={() =>
            void onSubmit({ type: "COUNTER", name: "Visits today", code: "visits-today" })
          }
        >
          save
        </button>
        {error && <p>{typeof error === "string" ? error : error.message}</p>}
      </div>
    ) : null,
}));

import { InlineCreateProvider, type InlineCreateContextValue } from "./inline-create-context";
import { COUNTER_CREATE_OPTIONS, useInlineTargetPicker } from "./use-inline-target-picker";

const target = (targetId: string, programIds: string[], type = "COUNTER") => ({
  targetId,
  code: targetId,
  name: `Name ${targetId}`,
  programIds,
  type,
});

function wrapper(ctx: Partial<InlineCreateContextValue> = {}) {
  const value: InlineCreateContextValue = {
    ruleProgramIds: ["p1"],
    isNewRule: true,
    organizationTimeZone: "America/Chicago",
    ...ctx,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <InlineCreateProvider value={value}>{children}</InlineCreateProvider>;
  };
}

function Harness({
  initial = "",
  onSelect,
}: {
  initial?: string;
  onSelect: (id: string, record?: { code?: string }) => void;
}) {
  const { pickerProps, createSheet } = useInlineTargetPicker({
    value: initial,
    onSelect,
    fieldKey: "a1.target",
    createOptions: COUNTER_CREATE_OPTIONS,
  });
  return (
    <>
      <button onClick={() => pickerProps.onCreateOption?.("counter")}>new counter</button>
      <span data-testid="suggested">{String(pickerProps.suggested)}</span>
      <span data-testid="created">{pickerProps.createdOption?.name ?? ""}</span>
      {createSheet}
    </>
  );
}

beforeEach(() => {
  targetFieldMock.state = {
    targets: [],
    isLoading: false,
    isLoadingAll: false,
    hasLoadAllError: false,
    hasNextPage: false,
    createTarget: vi.fn(),
  };
});

describe("useInlineTargetPicker (pickers brief)", () => {
  it("offers nothing extra outside a provider (pickers elsewhere keep today's behavior)", () => {
    const { result } = renderHook(() =>
      useInlineTargetPicker({ value: "", onSelect: vi.fn(), fieldKey: "k" })
    );
    expect(result.current.pickerProps.createOptions).toBeUndefined();
    expect(result.current.pickerProps.suggested).toBe(false);
    expect(result.current.createSheet).toBeNull();
  });

  it("S3: preselects the only fitting target on a new rule and marks it Suggested", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"]), target("t2", ["p2"])];
    const onSelect = vi.fn();
    const onSuggestionChange = vi.fn();
    render(<Harness onSelect={onSelect} />, { wrapper: wrapper({ onSuggestionChange }) });
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith("t1", expect.objectContaining({ code: "t1" }))
    );
  });

  it("S3/S5: the mark stays on the untouched pick, Checks hears about it, and both clear once the user changes it", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"]), target("t2", ["p2"])];
    const onSuggestionChange = vi.fn();
    function Stateful() {
      const [value, setValue] = useState("");
      const { pickerProps } = useInlineTargetPicker({
        value,
        onSelect: (id) => setValue(id),
        fieldKey: "a1.target",
      });
      return (
        <>
          <span data-testid="suggested">{String(pickerProps.suggested)}</span>
          <button onClick={() => setValue("t2")}>pick t2</button>
        </>
      );
    }
    render(<Stateful />, { wrapper: wrapper({ onSuggestionChange }) });
    await waitFor(() => expect(screen.getByTestId("suggested").textContent).toBe("true"));
    expect(onSuggestionChange).toHaveBeenLastCalledWith(
      "a1.target",
      expect.objectContaining({ label: "Name t1" })
    );
    fireEvent.click(screen.getByText("pick t2"));
    await waitFor(() => expect(screen.getByTestId("suggested").textContent).toBe("false"));
    expect(onSuggestionChange).toHaveBeenLastCalledWith("a1.target", null);
  });

  it("S5: a suggestion changed and then picked again by hand stays cleared (Codex fe#1960)", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"]), target("t2", ["p2"])];
    const onSuggestionChange = vi.fn();
    function Stateful() {
      const [value, setValue] = useState("");
      const { pickerProps } = useInlineTargetPicker({
        value,
        onSelect: (id) => setValue(id),
        fieldKey: "a1.target",
      });
      return (
        <>
          <span data-testid="suggested">{String(pickerProps.suggested)}</span>
          <button onClick={() => setValue("t2")}>pick t2</button>
          <button onClick={() => setValue("t1")}>pick t1</button>
        </>
      );
    }
    render(<Stateful />, { wrapper: wrapper({ onSuggestionChange }) });
    await waitFor(() => expect(screen.getByTestId("suggested").textContent).toBe("true"));
    fireEvent.click(screen.getByText("pick t2"));
    await waitFor(() => expect(screen.getByTestId("suggested").textContent).toBe("false"));
    fireEvent.click(screen.getByText("pick t1"));
    expect(screen.getByTestId("suggested").textContent).toBe("false");
    expect(onSuggestionChange).toHaveBeenLastCalledWith("a1.target", null);
  });

  it("S5/I3: the suggestion stays listed when the picker unmounts (the action editor closed) and names the pick", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"]), target("t2", ["p2"])];
    const onSuggestionChange = vi.fn();
    function Stateful() {
      const [value, setValue] = useState("");
      const { pickerProps } = useInlineTargetPicker({
        value,
        onSelect: (id) => setValue(id),
        fieldKey: "a1.target",
      });
      return <span data-testid="suggested">{String(pickerProps.suggested)}</span>;
    }
    const { unmount } = render(<Stateful />, { wrapper: wrapper({ onSuggestionChange }) });
    await waitFor(() => expect(screen.getByTestId("suggested").textContent).toBe("true"));
    unmount();
    expect(onSuggestionChange).toHaveBeenLastCalledWith(
      "a1.target",
      expect.objectContaining({ id: "t1", label: "Name t1" })
    );
  });

  it("More options in the compact sheet gets the organization's targets (X of Y and Milestone pickers)", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"]), target("t2", ["p2"])];
    render(<Harness initial="t2" onSelect={vi.fn()} />, { wrapper: wrapper({ isNewRule: false }) });
    fireEvent.click(screen.getByText("new counter"));
    expect(screen.getByRole("dialog").getAttribute("data-all-targets")).toBe("2");
  });

  it("an optional picker with suggest=false never preselects", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"])];
    const onSelect = vi.fn();
    renderHook(
      () => useInlineTargetPicker({ value: "", onSelect, fieldKey: "k", suggest: false }),
      { wrapper: wrapper() }
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("S15: an existing rule never gets a preselection", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"])];
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />, { wrapper: wrapper({ isNewRule: false }) });
    await new Promise((r) => setTimeout(r, 20));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("S16: no preselection while the list is still loading", async () => {
    targetFieldMock.state.targets = [target("t1", ["p1"])];
    targetFieldMock.state.isLoadingAll = true;
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />, { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("S1/I4: '+ New' opens the compact sheet with the rule's programs and selects the record only once it exists", async () => {
    let resolveCreate!: (v: unknown) => void;
    targetFieldMock.state.createTarget = vi.fn(() => new Promise((r) => (resolveCreate = r)));
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />, { wrapper: wrapper({ isNewRule: false }) });
    fireEvent.click(screen.getByText("new counter"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-preset")).toBe("counter");
    expect(dialog.getAttribute("data-programs")).toBe("p1");
    expect(dialog.getAttribute("data-tz")).toBe("America/Chicago");
    fireEvent.click(screen.getByText("save"));
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () =>
      resolveCreate({ targetId: "t-new", code: "visits-today", name: "Visits today" })
    );
    expect(onSelect).toHaveBeenCalledWith(
      "t-new",
      expect.objectContaining({ code: "visits-today" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Codex fe#1960: the picker can show the new record even when its list or search lacks it.
    expect(screen.getByTestId("created").textContent).toBe("Visits today");
  });

  it("S8: a rejected create shows its error in the sheet and leaves the parent draft alone", async () => {
    targetFieldMock.state.createTarget = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Code already exists"), { status: 409 }));
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />, { wrapper: wrapper({ isNewRule: false }) });
    fireEvent.click(screen.getByText("new counter"));
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toMatch(/exists|went wrong|create/i)
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
