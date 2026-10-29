import type { MetadataGroup } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { metadataField } = vi.hoisted(() => ({
  metadataField: {
    createMetadata: vi.fn(),
    useMetadataField: vi.fn(() => ({
      createMetadata: vi.fn(),
      findOption: vi.fn(),
      isTypeNotFound: false,
    })),
  },
}));

vi.mock("../../../forms/metadata-type-field/metadata-type-field", () => ({
  MetadataTypeField: ({
    value,
    onValueChange,
    ...rest
  }: {
    value: string;
    onValueChange: (value: string) => void;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      data-widget="metadata-type-combobox"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
}));

vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: (): ReactNode => <input data-widget="metadata-select" />,
  useMetadataField: metadataField.useMetadataField,
}));

import { MetadataGroupFormSheet } from "./metadata-group-form-sheet.js";

function renderSheet(overrides: Partial<React.ComponentProps<typeof MetadataGroupFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const renderResult = render(
    <MetadataGroupFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onSubmit, onOpenChange, ...renderResult };
}

describe("MetadataGroupFormSheet", () => {
  it("creates a group with the chosen metadata type code", async () => {
    const { onSubmit } = renderSheet();

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Events" } });
    fireEvent.change(screen.getByLabelText(/^Metadata Type/i), {
      target: { value: "EVENT_TYPE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Metadata Group/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Events", code: "events", typeCode: "EVENT_TYPE" })
    );
  });

  it("requires a type before submitting and never falls back to default", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Events" } });

    const submit = screen.getByRole("button", { name: /Create Metadata Group/i });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Metadata Type/i), {
      target: { value: "EVENT_TYPE" },
    });
    fireEvent.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).not.toMatchObject({ typeCode: "default" });
  });

  it("uses only metadata types, never METADATA_GROUP_TYPE metadata entries", () => {
    renderSheet();

    expect(metadataField.useMetadataField).not.toHaveBeenCalled();
    expect(metadataField.createMetadata).not.toHaveBeenCalled();
    expect(document.querySelector('[data-widget="metadata-select"]')).toBeNull();
  });

  it("locks the existing type in edit mode and submits it unchanged", async () => {
    const initialData = {
      metadataGroupId: "group-1",
      code: "events",
      name: "Events",
      typeCode: "EVENT_TYPE",
    } as MetadataGroup;
    const { onSubmit } = renderSheet({ mode: "edit", initialData });

    const typeControl = screen.getByLabelText(/^Metadata Type/i) as HTMLInputElement;
    expect(typeControl).toHaveAttribute("readonly");
    expect(typeControl).not.toHaveAttribute("aria-required");
    expect(typeControl.value).toBe("EVENT_TYPE");
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Event catalog" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ typeCode: "EVENT_TYPE" });
  });

  it("labels the required metadata type control", () => {
    renderSheet();

    const typeControl = screen.getByLabelText(/^Metadata Type/i);
    expect(typeControl).toHaveAttribute("aria-required", "true");
  });

  it("presets and locks the type in create mode", async () => {
    const { onSubmit } = renderSheet({ lockedTypeCode: "STORE" });

    const typeControl = screen.getByLabelText(/^Metadata Type/i) as HTMLInputElement;
    expect(typeControl).toHaveValue("STORE");
    expect(typeControl).toHaveAttribute("readonly");
    expect(typeControl).toHaveAttribute("aria-describedby", "metadata-group-type-code-hint");
    expect(screen.getByText(/metadata type is fixed/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Texas stores" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Metadata Group/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ typeCode: "STORE" }));
  });

  it("uses the selection summary as the dialog description and labels that create flow Save group", () => {
    renderSheet({ summary: "Adds 12 selected entries" });

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Adds 12 selected entries");
    expect(screen.getByRole("button", { name: "Save group" })).toBeInTheDocument();
  });

  it("shows a focusable locked code even when it is not a loaded option", () => {
    renderSheet({ lockedTypeCode: "UNLOADED_TYPE" });

    const typeControl = screen.getByLabelText(/^Metadata Type/i);
    expect(typeControl).toHaveValue("UNLOADED_TYPE");
    expect(typeControl).toHaveAttribute("readonly");
    typeControl.focus();
    expect(typeControl).toHaveFocus();
    expect(screen.queryByText("Select metadata type...")).not.toBeInTheDocument();
  });

  it("uses the updated locked type code without remounting", async () => {
    const { onSubmit, rerender } = renderSheet({ lockedTypeCode: "STORE" });
    rerender(
      <MetadataGroupFormSheet
        open
        onOpenChange={vi.fn()}
        mode="create"
        lockedTypeCode="LOCATION"
        onSubmit={onSubmit}
      />
    );
    const typeControl = screen.getByLabelText(/^Metadata Type/i);
    expect(typeControl).toHaveValue("LOCATION");
    const submit = screen.getByRole("button", { name: /Create Metadata Group/i });
    expect(submit).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Locations" } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ typeCode: "LOCATION" }))
    );
  });

  it("allows an edit with an empty persisted type code", async () => {
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData: {
        metadataGroupId: "group-1",
        code: "empty",
        name: "Empty",
        typeCode: "",
      } as MetadataGroup,
    });

    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ typeCode: "" }))
    );
  });

  it("does not close or reset while submitting", () => {
    const { onOpenChange, rerender } = renderSheet({ lockedTypeCode: "STORE" });
    const name = screen.getByLabelText(/^Name/i);
    fireEvent.change(name, { target: { value: "Texas stores" } });

    rerender(
      <MetadataGroupFormSheet
        open
        onOpenChange={onOpenChange}
        mode="create"
        lockedTypeCode="STORE"
        onSubmit={vi.fn()}
        isSubmitting
      />
    );

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText(/^Name/i)).toHaveValue("Texas stores");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
