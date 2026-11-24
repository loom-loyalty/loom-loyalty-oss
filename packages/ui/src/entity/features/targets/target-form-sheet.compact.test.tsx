/**
 * TargetFormSheet compact mode (pickers brief S6, S7, S8, S11, S18).
 * Mocks match target-form-sheet.test.tsx.
 *
 * Original header of the shared mocks:
 * TargetFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * TARGET is polymorphic across FOUR variants — `type` drives whether the
 * COMPLETION / COUNTER / MILESTONE / X_OF_Y configuration block renders.
 * Direction C pins the discriminator-gated branches (the defining audit
 * assertion for a polymorphic entity).
 *
 * `ProgramMultiField` + `MetadataField`/`useMetadataField` are mocked because
 * they pull the SDK + react-query at import time. The milestone/xofy target
 * pickers are inline Popover+Command (no SDK), and the compound widgets
 * (`CodeInput`, `LocalizedStringInput`) are pure presentation, so they mount
 * for real.
 *
 * L2 (audit-side Zod schema) lives in target-form-sheet.schema.test.ts.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../forms/program-field/index.js", () => ({
  ProgramMultiField: ({
    id,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    value: string[];
    onValueChange: (ids: string[]) => void;
    disabled?: boolean;
  }) => (
    <div data-mock="program-multi-field">
      {/* Forward the caller-provided id so <Label htmlFor> binds to a real
          DOM node — matches the production ProgramMultiField contract and
          keeps the WCAG 1.3.1 test honest. */}
      <input id={id} type="text" readOnly value={value.join(",")} />
      <button
        type="button"
        data-testid="program-multi-field-add"
        disabled={disabled}
        onClick={() => onValueChange([...value, "prog_550e8400e29b41d4a716446655440000"])}
      >
        Add Program
      </button>
    </div>
  ),
}));

// Hoisted mutable state so individual tests can flip the isSuggested flag fired
// by MetadataField's onValueChange + override the useMetadataField return shape.
// vi.mock factories are hoisted; use vi.hoisted to share state with them.
const metadataFieldMock = vi.hoisted(() => {
  const mock = {
    fireAsSuggested: false as boolean,
    hookReturn: {
      category: undefined as string | undefined,
      isTypeNotFound: false as boolean,
      findOption: ((_code: string) => undefined) as (code: string) => unknown,
      metadataOptionsAll: [] as Array<{ code: string; name: string }>,
      isLoading: false as boolean,
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    },
  };

  return Object.assign(mock, {
    useMetadataField: vi.fn((_typeCode: string) => mock.hookReturn),
  });
});

// Stub MetadataField + useMetadataField; the form mounts both so neither can hit the real SDK.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
  }: {
    id?: string;
    typeCode: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
  }) => (
    <input
      id={id}
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      value={value}
      onChange={(e) => onValueChange(e.target.value, metadataFieldMock.fireAsSuggested)}
    />
  ),
  useMetadataField: metadataFieldMock.useMetadataField,
}));

beforeEach(() => {
  metadataFieldMock.fireAsSuggested = false;
  metadataFieldMock.useMetadataField.mockClear();
  metadataFieldMock.hookReturn = {
    category: "METADATA",
    isTypeNotFound: false,
    findOption: (code: string) =>
      code === "visit-target"
        ? { code: "visit-target", name: "Visit Target", description: "Visits", isSuggested: true }
        : undefined,
    metadataOptionsAll: [],
    isLoading: false,
    createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };
});

import { TargetFormSheet } from "./target-form-sheet.js";
import type { TargetFormSheetProps } from "./types.js";

function renderCompact(overrides: Partial<TargetFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <TargetFormSheet
      open
      onOpenChange={vi.fn()}
      mode="create"
      variant="compact"
      preset="counter"
      defaultProgramIds={["prog_1"]}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...result, onSubmit };
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

describe("TargetFormSheet compact (pickers brief)", () => {
  it("S6: asks only for a name and a number", () => {
    renderCompact();
    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByLabelText(/how many/i)).toBeTruthy();
    expect(document.getElementById("target-scope")).toBeNull();
    expect(screen.queryByRole("radio", { name: /^counter$/i })).toBeNull();
    expect(document.getElementById("target-code")).toBeNull();
  });

  it("S6: saves a COUNTER with a derived code, the rule's programs and a suggested counter type created on save", async () => {
    const { onSubmit } = renderCompact();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits today" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "10" } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      type: "COUNTER",
      name: "Visits today",
      code: "visits-today",
      programIds: ["prog_1"],
      counterTargetTypeCode: "visit-target",
      targetValue: 10,
    });
    expect(metadataFieldMock.hookReturn.createMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ code: "visit-target" })
    );
  });

  it("S6: reuses an existing visit counter type instead of creating one", async () => {
    metadataFieldMock.hookReturn.metadataOptionsAll = [{ code: "visits", name: "Visit Target" }];
    metadataFieldMock.hookReturn.findOption = (code: string) =>
      code === "visits" ? { code: "visits", name: "Visit Target" } : undefined;
    const { onSubmit } = renderCompact();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "5" } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ counterTargetTypeCode: "visits" });
    expect(metadataFieldMock.hookReturn.createMetadata).not.toHaveBeenCalled();
  });

  it("S11: a Daily limit is a capping counter of 1 with a 1-day calendar cycle in the organization's zone", async () => {
    const { onSubmit } = renderCompact({
      preset: "daily-limit",
      defaultTimeZone: "America/Chicago",
    });
    expect((screen.getByLabelText(/^name/i) as HTMLInputElement).value).toBe("Daily limit");
    expect((screen.getByLabelText(/limit per day/i) as HTMLInputElement).value).toBe("1");
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      type: "COUNTER",
      cappingTarget: true,
      targetValue: 1,
      // One cycle per day for about ten years: without a count the API makes a single cycle,
      // and every check-in after the first day fails.
      numberOfCycles: 3650,
      cycleDurationPeriod: {
        durationPeriodType: "CALENDAR",
        durationPeriod: "DAYS",
        durationPeriodValue: 1,
        timeZone: "America/Chicago",
      },
    });
  });

  it("S11: a Weekly limit resets every calendar week", async () => {
    const { onSubmit } = renderCompact({
      preset: "weekly-limit",
      defaultTimeZone: "America/Chicago",
    });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      cappingTarget: true,
      numberOfCycles: 520,
      cycleDurationPeriod: { durationPeriod: "WEEKS", durationPeriodType: "CALENDAR" },
    });
  });

  it("S7: More options shows the full form in place, keeping what was typed", () => {
    renderCompact();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits today" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /more options/i }));
    expect(document.getElementById("target-scope")).not.toBeNull();
    expect((document.getElementById("target-name") as HTMLInputElement).value).toBe("Visits today");
    expect((document.getElementById("counter-target-value") as HTMLInputElement).value).toBe("7");
  });

  it("S18: pressing Save twice creates one record", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    renderCompact({ onSubmit });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "3" } });
    submit();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    submit();
    resolve();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("S18: a name with no usable characters reveals the code field with an error", async () => {
    const { onSubmit } = renderCompact();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "☕☕" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "3" } });
    submit();
    await waitFor(() => expect(document.getElementById("target-code")).not.toBeNull());
    expect(screen.getByText(/enter a code/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("S18: a code the API rejects reveals the code field", () => {
    renderCompact({
      error: "A target with this code already exists.",
      fieldErrors: [{ field: "code", message: "Code already exists" }],
    });
    expect(document.getElementById("target-code")).not.toBeNull();
  });

  it("S8: an API error shows inside the compact sheet", () => {
    renderCompact({ error: "Something went wrong creating the target." });
    expect(screen.getByText("Something went wrong creating the target.")).toBeTruthy();
  });

  it("S1: a completion target asks for a name only and uses a suggested completion type", async () => {
    metadataFieldMock.hookReturn.findOption = (code: string) =>
      code === "activity-completion"
        ? { code, name: "Activity Completion", isSuggested: true }
        : undefined;
    const { onSubmit } = renderCompact({ preset: "completion" });
    expect(screen.queryByLabelText(/how many/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Finished profile" } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      type: "COMPLETION",
      code: "finished-profile",
      completionTargetTypeCode: "activity-completion",
    });
  });

  it("asks for programs when the rule has none", () => {
    renderCompact({ defaultProgramIds: [] });
    expect(screen.getByTestId("program-multi-field-add")).toBeTruthy();
  });
  it("S11: a Daily limit opened in More options still sends its cycle count", async () => {
    const { onSubmit } = renderCompact({
      preset: "daily-limit",
      defaultTimeZone: "America/Chicago",
    });
    fireEvent.click(screen.getByRole("button", { name: /^more options$/i }));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      cappingTarget: true,
      numberOfCycles: 3650,
      cycleDurationPeriod: { durationPeriod: "DAYS", timeZone: "America/Chicago" },
    });
  });

  it("More options moves focus to the first field it reveals", async () => {
    renderCompact();
    fireEvent.click(screen.getByRole("button", { name: /^more options$/i }));
    await waitFor(() =>
      expect(document.getElementById("target-type")?.contains(document.activeElement)).toBe(true)
    );
  });

  it("reopening starts again from the preset, and a new preset replaces the old one", () => {
    const props = { onOpenChange: vi.fn(), mode: "create" as const, variant: "compact" as const };
    const { rerender } = render(
      <TargetFormSheet
        {...props}
        open
        preset="counter"
        onSubmit={vi.fn()}
        defaultProgramIds={["prog_1"]}
      />
    );
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits" } });
    rerender(
      <TargetFormSheet
        {...props}
        open={false}
        preset="counter"
        onSubmit={vi.fn()}
        defaultProgramIds={["prog_1"]}
      />
    );
    rerender(
      <TargetFormSheet
        {...props}
        open
        preset="weekly-limit"
        onSubmit={vi.fn()}
        defaultProgramIds={["prog_1"]}
      />
    );
    expect((screen.getByLabelText(/^name/i) as HTMLInputElement).value).toBe("Weekly limit");
  });

  it("an organization zone that arrives after opening moves the limit to it and keeps what was typed", async () => {
    const props = {
      onOpenChange: vi.fn(),
      mode: "create" as const,
      variant: "compact" as const,
      preset: "daily-limit" as const,
      defaultProgramIds: ["prog_1"],
    };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <TargetFormSheet {...props} open onSubmit={onSubmit} defaultTimeZone="Europe/London" />
    );
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Once a day" } });
    rerender(
      <TargetFormSheet {...props} open onSubmit={onSubmit} defaultTimeZone="America/Chicago" />
    );
    expect((screen.getByLabelText(/^name/i) as HTMLInputElement).value).toBe("Once a day");
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      name: "Once a day",
      cycleDurationPeriod: { timeZone: "America/Chicago" },
    });
  });

  it("an organization zone that arrives late leaves a zone picked by hand alone (Codex fe#1960)", async () => {
    const props = {
      onOpenChange: vi.fn(),
      mode: "create" as const,
      variant: "compact" as const,
      preset: "daily-limit" as const,
      defaultProgramIds: ["prog_1"],
    };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <TargetFormSheet {...props} open onSubmit={onSubmit} defaultTimeZone="Europe/London" />
    );
    fireEvent.click(screen.getByRole("button", { name: /^more options$/i }));
    fireEvent.click(document.getElementById("cycle-window-time-zone")!);
    fireEvent.click(await screen.findByRole("option", { name: /Asia\/Tokyo/ }));
    rerender(
      <TargetFormSheet {...props} open onSubmit={onSubmit} defaultTimeZone="America/Chicago" />
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      cycleDurationPeriod: { timeZone: "Asia/Tokyo" },
    });
  });

  it("loads every page of counter types before it can save, so an existing one is never re-created (Codex fe#1960)", () => {
    const fetchNextPage = vi.fn();
    Object.assign(metadataFieldMock.hookReturn, {
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    });
    renderCompact();
    expect(fetchNextPage).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("More options keeps a 44px touch target (Codex fe#1960)", () => {
    renderCompact();
    const button = screen.getByRole("button", { name: /^more options$/i });
    expect(button.className).toContain("min-h-11");
    expect(button.className).not.toContain("h-auto");
  });

  it("a failed counter-type create shows its error in the sheet and creates no target (Codex fe#1960)", async () => {
    metadataFieldMock.hookReturn.createMetadata = vi
      .fn<(data: unknown) => Promise<void>>()
      .mockRejectedValue(new Error("Network down"));
    const { onSubmit } = renderCompact();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Visits" } });
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "5" } });
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/network down|couldn't/i)
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("waits for the organization's counter types before it can save", () => {
    metadataFieldMock.hookReturn.isLoading = true;
    renderCompact();
    expect((screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
