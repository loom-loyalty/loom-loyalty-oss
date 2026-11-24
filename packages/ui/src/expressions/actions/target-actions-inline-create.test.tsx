// Pickers brief S1: every Then-do action that names a target offers "+ New …"
// and a Suggested pick through useInlineTargetPicker, and keeps the target's
// code when the created record isn't in the loaded list yet.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import type { ComponentType, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedTargetField {
  value: string;
  onValueChange: (id: string) => void;
  createOptions?: unknown;
  onCreateOption?: (key: string) => void;
  suggested?: boolean;
}

const captured = vi.hoisted(() => ({
  field: null as CapturedTargetField | null,
  pickerOptions: null as null | {
    onSelect: (id: string, record?: { code?: string }) => void;
    createOptions?: Array<{ key: string }>;
    fieldKey: string;
  },
}));

vi.mock("../../forms/target-field/index.js", () => ({
  TargetField: (p: CapturedTargetField) => {
    captured.field = p;
    return null;
  },
}));
vi.mock("../../forms/target-field/use-target-field.js", () => ({
  useTargetField: () => ({ targets: [], findTarget: () => undefined }),
}));
vi.mock("../../forms/program-field/index.js", () => ({ ProgramField: () => null }));
vi.mock("../../forms/program-field/use-program-field.js", () => ({
  useProgramField: () => ({ findProgram: () => undefined }),
}));
vi.mock("../../forms/event-rule-field/index.js", () => ({ EventRuleField: () => null }));
vi.mock("../../forms/event-rule-field/use-event-rule-field.js", () => ({
  useEventRuleField: () => ({ findEventRule: () => undefined }),
}));
vi.mock("../inline-create/use-inline-target-picker.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useInlineTargetPicker: (options: NonNullable<typeof captured.pickerOptions>) => {
      captured.pickerOptions = options;
      return {
        pickerProps: {
          createOptions: options.createOptions,
          onCreateOption: vi.fn(),
          suggested: true,
        },
        createSheet: <div data-testid="inline-create-sheet" />,
      };
    },
  };
});

import { AddCounterDataActionComponent } from "./add-counter-data-action";
import { CompleteTargetActionComponent } from "./complete-target-action";
import { RegisterTargetActionComponent } from "./register-target-action";

const cases: Array<
  [string, ComponentType<{ value: object; onChange: (v: object) => void }>, string]
> = [
  ["add counter data", AddCounterDataActionComponent as never, "counter"],
  ["register target", RegisterTargetActionComponent as never, "counter"],
  ["complete target", CompleteTargetActionComponent as never, "completion"],
];

const render = (node: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}
    >
      {node}
    </QueryClientProvider>
  );

beforeEach(() => {
  captured.field = null;
  captured.pickerOptions = null;
});

describe.each(cases)("%s action (S1)", (_name, Component, createKey) => {
  it("passes '+ New …' choices and the Suggested mark to the target picker, and renders the compact sheet", () => {
    render(<Component value={{}} onChange={vi.fn()} />);
    expect(captured.field?.createOptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: createKey })])
    );
    expect(captured.field?.suggested).toBe(true);
    expect(typeof captured.field?.onCreateOption).toBe("function");
    expect(screen.getByTestId("inline-create-sheet")).toBeTruthy();
  });

  it("selects a just-created target with its code, before the list refetches", () => {
    const onChange = vi.fn();
    render(<Component value={{}} onChange={onChange} />);
    captured.pickerOptions!.onSelect("t-new", { code: "visits-today" });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "t-new", targetCode: "visits-today" })
    );
  });
});
