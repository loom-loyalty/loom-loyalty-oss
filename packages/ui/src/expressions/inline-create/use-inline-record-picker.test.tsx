// Pickers brief S2, S8, S19 and I4 for offer, badge and tier "+ New …".

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: object) => Promise<void>;
  defaultProgramIds?: string[];
  error?: { message?: string } | null;
}

const { state, sheet } = vi.hoisted(() => {
  const state = {
    sheet: null as null | { kind: string; props: SheetProps },
    mutate: vi.fn(),
  };
  const capture = (kind: string, props: SheetProps) => {
    state.sheet = { kind, props };
  };
  const sheet = (kind: string) => {
    function MockSheet(props: SheetProps) {
      capture(kind, props);
      return <div data-testid={`${kind}-sheet`}>{props.error?.message}</div>;
    }
    return MockSheet;
  };
  return { state, sheet };
});
vi.mock("../../entity/features/offers/offer-form-sheet.js", () => ({
  OfferFormSheet: sheet("offer"),
}));
vi.mock("../../entity/features/badges/badge-form-sheet.js", () => ({
  BadgeFormSheet: sheet("badge"),
}));
vi.mock("../../entity/features/tiers/tier-form-sheet.js", () => ({
  TierFormSheet: sheet("tier"),
}));
vi.mock("@loom-loyalty/sdk", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mutation = () => ({ mutateAsync: state.mutate, isPending: false });
  return {
    ...actual,
    useOfferManagementCreateOffer: mutation,
    useCustomerStatusManagementCreateBadge: mutation,
    useCustomerStatusManagementCreateTier: mutation,
  };
});

import { InlineCreateProvider } from "./inline-create-context";
import {
  useInlineRecordPicker,
  type InlineRecordKind,
  type InlineRecordPickerProps,
} from "./use-inline-record-picker";

const picker: { props: InlineRecordPickerProps | null } = { props: null };
const capturePicker = (props: InlineRecordPickerProps) => {
  picker.props = props;
};

function Harness({
  kind,
  onSelect,
  idField,
}: {
  kind: InlineRecordKind;
  onSelect: (id: string, record?: object) => void;
  idField?: "id" | "code";
}): ReactNode {
  const { pickerProps, createSheet } = useInlineRecordPicker({ kind, onSelect, idField });
  capturePicker(pickerProps);
  return <>{createSheet}</>;
}

const renderIn = (node: ReactNode, withProvider = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      {withProvider ? (
        <InlineCreateProvider value={{ ruleProgramIds: ["p-1"], isNewRule: true }}>
          {node}
        </InlineCreateProvider>
      ) : (
        node
      )}
    </QueryClientProvider>
  );

beforeEach(() => {
  state.sheet = null;
  state.mutate.mockReset();
  picker.props = null;
});

describe.each<[InlineRecordKind, string]>([
  ["offer", "offerId"],
  ["badge", "badgeId"],
  ["tier", "tierId"],
])("useInlineRecordPicker (%s)", (kind, idKey) => {
  it("offers one '+ New' choice and opens the sheet with the rule's programs", () => {
    renderIn(<Harness kind={kind} onSelect={vi.fn()} />);
    expect(picker.props?.createOptions).toEqual([expect.objectContaining({ key: kind })]);
    expect(screen.queryByTestId(`${kind}-sheet`)).toBeNull();
    act(() => picker.props!.onCreateOption!(kind));
    expect(state.sheet?.kind).toBe(kind);
    expect(state.sheet?.props.defaultProgramIds).toEqual(["p-1"]);
  });

  it("selects the record only after it exists, then closes (I4)", async () => {
    const onSelect = vi.fn();
    state.mutate.mockResolvedValue({
      data: { [idKey]: "new-1", code: "free-wash", name: "Free wash" },
    });
    renderIn(<Harness kind={kind} onSelect={onSelect} />);
    act(() => picker.props!.onCreateOption!(kind));
    expect(onSelect).not.toHaveBeenCalled();
    await act(() => state.sheet!.props.onSubmit({ code: "free-wash", name: "Free wash" }));
    expect(state.mutate).toHaveBeenCalledWith({ data: { code: "free-wash", name: "Free wash" } });
    expect(onSelect).toHaveBeenCalledWith("new-1", { code: "free-wash", name: "Free wash" });
    expect(screen.queryByTestId(`${kind}-sheet`)).toBeNull(); // Codex fe#1960: the picker can show the new record before its list or search holds it.
    expect(picker.props!.createdOption).toEqual({
      id: "new-1",
      name: "Free wash",
      secondaryText: "free-wash",
    });
  });

  it("keys the created option by code for a field that selects by code (Codex fe#1960)", async () => {
    state.mutate.mockResolvedValue({
      data: { [idKey]: "new-1", code: "free-wash", name: "Free wash" },
    });
    renderIn(<Harness kind={kind} onSelect={vi.fn()} idField="code" />);
    act(() => picker.props!.onCreateOption!(kind));
    await act(() => state.sheet!.props.onSubmit({ code: "free-wash", name: "Free wash" }));
    expect(picker.props!.createdOption?.id).toBe("free-wash");
  });

  it("keeps a failed create's error in the sheet and leaves the pick alone (S8)", async () => {
    const onSelect = vi.fn();
    state.mutate.mockRejectedValue(new Error("Code already in use"));
    renderIn(<Harness kind={kind} onSelect={onSelect} />);
    act(() => picker.props!.onCreateOption!(kind));
    await act(() => state.sheet!.props.onSubmit({ code: "x", name: "X" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId(`${kind}-sheet`)).toBeTruthy();
    expect(state.sheet?.props.error).toBeTruthy();
  });

  it("closing the sheet leaves the pick alone (S19)", () => {
    const onSelect = vi.fn();
    renderIn(<Harness kind={kind} onSelect={onSelect} />);
    act(() => picker.props!.onCreateOption!(kind));
    act(() => state.sheet!.props.onOpenChange(false));
    expect(screen.queryByTestId(`${kind}-sheet`)).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("adds nothing outside a rule or flow", () => {
    renderIn(<Harness kind={kind} onSelect={vi.fn()} />, false);
    expect(picker.props).toEqual({ suggested: false });
  });
});
