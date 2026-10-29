import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReadOnlyProvider } from "../shell/read-only";
import { FieldErrorMessage, useFieldError, WithFieldError } from "./field-errors";
import { FormErrorBanner } from "./form-error-banner";
import { FormSheet } from "./form-sheet";

function TextField({ field, label }: { field: string; label: string }): ReactNode {
  const { error, errorId, inputProps } = useFieldError(field);
  return (
    <div>
      <label htmlFor={field}>{label}</label>
      <input id={field} name={field} {...inputProps} />
      <FieldErrorMessage id={errorId} error={error} />
    </div>
  );
}

function PickerField({ field, label }: { field: string; label: string }): ReactNode {
  const { error, errorId, inputProps, dismiss } = useFieldError(field);
  return (
    <div>
      <button type="button" aria-label={label} {...inputProps} onClick={dismiss}>
        Pick
      </button>
      <FieldErrorMessage id={errorId} error={error} />
    </div>
  );
}

function renderSheet(props: Partial<Parameters<typeof FormSheet>[0]> = {}) {
  return render(
    <FormSheet
      open
      onOpenChange={vi.fn()}
      title="Create customer"
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    >
      <TextField field="code" label="Code" />
      <TextField field="email" label="Email" />
    </FormSheet>
  );
}

describe("FormSheet field errors", () => {
  const fieldErrors = [
    { field: "code", message: "Code is required." },
    { field: "email", message: "Email is invalid." },
  ];

  it("shows each server error under its own field with ARIA wiring", () => {
    renderSheet({ fieldErrors });

    const code = screen.getByLabelText("Code");
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription("Code is required.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is invalid.");
  });

  it("moves focus to the first invalid field", async () => {
    renderSheet({ fieldErrors: [{ field: "email", message: "Email is invalid." }] });

    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("clears a field's error when the user edits it", () => {
    renderSheet({ fieldErrors });

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "VIP" } });

    expect(screen.getByLabelText("Code")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Code is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Email is invalid.")).toBeInTheDocument();
  });

  it("keeps dismissals and focus when the parent re-renders with an equal errors array", async () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      title: "Create customer",
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };
    const sheet = (errors: { field: string; message: string }[]) => (
      <FormSheet {...props} fieldErrors={errors}>
        <TextField field="code" label="Code" />
        <TextField field="email" label="Email" />
      </FormSheet>
    );
    const { rerender } = render(sheet(fieldErrors.map((e) => ({ ...e }))));
    await waitFor(() => expect(screen.getByLabelText("Code")).toHaveFocus());

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "VIP" } });
    screen.getByLabelText("Email").focus();
    rerender(sheet(fieldErrors.map((e) => ({ ...e }))));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(screen.queryByText("Code is required.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("shows a dismissed error again when a resubmit fails the same way", () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      title: "Create customer",
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      fieldErrors,
    };
    const sheet = (isSubmitting: boolean) => (
      <FormSheet {...props} isSubmitting={isSubmitting}>
        <TextField field="code" label="Code" />
        <TextField field="email" label="Email" />
      </FormSheet>
    );
    const { rerender } = render(sheet(false));

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "VIP" } });
    expect(screen.queryByText("Code is required.")).not.toBeInTheDocument();

    rerender(sheet(true));
    rerender(sheet(false));

    expect(screen.getByText("Code is required.")).toBeInTheDocument();
  });

  it("lets a custom widget clear its own error", () => {
    render(
      <FormSheet
        open
        onOpenChange={vi.fn()}
        title="Create offer"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        fieldErrors={[{ field: "tier", message: "Pick a tier." }]}
      >
        <PickerField field="tier" label="Tier" />
      </FormSheet>
    );

    expect(screen.getByText("Pick a tier.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tier" }));
    expect(screen.queryByText("Pick a tier.")).not.toBeInTheDocument();
  });

  it("shows errors for fields that are not rendered in the footer banner", async () => {
    renderSheet({
      fieldErrors: [
        { field: "code", message: "Code is required." },
        { field: "items[2].sku", message: "SKU is unknown." },
      ],
    });

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((el) => el.textContent?.includes("SKU is unknown."))
      ).toBe(true)
    );
    // The rendered field's error is not repeated in the banner.
    expect(screen.getAllByText("Code is required.")).toHaveLength(1);
  });

  it("shows a described error's message with its support reference", () => {
    renderSheet({
      error: { message: "Something went wrong. Please try again.", requestId: "req-9" },
    });

    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.getByText("req-9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy support reference" })).toBeInTheDocument();
  });

  it("still accepts a plain string error", () => {
    renderSheet({ error: "Name already taken." });

    expect(screen.getByText("Name already taken.")).toBeInTheDocument();
  });
});

describe("WithFieldError", () => {
  function ValueField({ value }: { value: string }): ReactNode {
    return (
      <WithFieldError field="typeCode" value={value}>
        {(fe) => (
          <button type="button" aria-label="Type" {...fe.inputProps}>
            {value}
          </button>
        )}
      </WithFieldError>
    );
  }

  function renderWithValue(value: string) {
    return (
      <FormSheet
        open
        onOpenChange={vi.fn()}
        title="Create metadata"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        fieldErrors={[{ field: "typeCode", message: "Type is unknown." }]}
      >
        <ValueField value={value} />
      </FormSheet>
    );
  }

  it("renders the message under the control and clears it when the value changes", () => {
    const { rerender } = render(renderWithValue("A"));

    const control = screen.getByRole("button", { name: "Type" });
    expect(control).toHaveAccessibleDescription("Type is unknown.");

    rerender(renderWithValue("B"));

    expect(screen.queryByText("Type is unknown.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type" })).not.toHaveAttribute("aria-invalid");
  });
});

describe("FormErrorBanner", () => {
  it("shows the message, field errors and the support reference", () => {
    render(
      <FormErrorBanner
        error={{ message: "Could not save.", requestId: "req-7" }}
        fieldErrors={[{ field: "name", message: "Name is required." }]}
      />
    );

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Could not save.");
    expect(banner).toHaveTextContent("Name is required.");
    expect(banner).toHaveTextContent("Reference: req-7");
  });

  it("renders nothing without an error", () => {
    const { container } = render(<FormErrorBanner error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FormSheet read-only", () => {
  const reason = "Your trial has ended. Add a payment method on the Billing page to keep editing.";

  it("disables submit and explains why while the app is read-only", () => {
    const onSubmit = vi.fn();
    render(
      <ReadOnlyProvider reason={reason}>
        <FormSheet
          open
          onOpenChange={vi.fn()}
          title="Create customer"
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        >
          <TextField field="code" label="Code" />
        </FormSheet>
      </ReadOnlyProvider>
    );

    const submit = screen.getByRole("button", { name: "Save" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription(reason);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

    fireEvent.submit(screen.getByLabelText("Code").closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the innermost reason, and an enclosing one when the inner has none", () => {
    render(
      <ReadOnlyProvider reason="Outer reason.">
        <ReadOnlyProvider reason={null}>
          <FormSheet open onOpenChange={vi.fn()} title="Edit" onSubmit={vi.fn()} onCancel={vi.fn()}>
            <TextField field="code" label="Code" />
          </FormSheet>
        </ReadOnlyProvider>
      </ReadOnlyProvider>
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAccessibleDescription(
      "Outer reason."
    );
  });

  it("submits normally outside a read-only provider", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
