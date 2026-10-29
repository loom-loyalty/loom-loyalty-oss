import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  AI_VERIFICATION_COPY,
  RequestEnableDialog,
  type EnvironmentOption,
} from "./request-enable-dialog";

// fillRequiredFields() opens a Radix select and types a date plus a 53-char
// justification one keystroke at a time. Each test takes 4-4.5s on a loaded CI
// runner against the default 5000ms budget, and a timed-out test leaves the
// dialog's pointer-events lock behind for the next one. Give the whole file
// headroom rather than trimming what the tests type.
vi.setConfig({ testTimeout: 20_000 });

/** Accessible-name matcher for the checkbox: the rendered label appends a
 * required-marker `*` after AI_VERIFICATION_COPY, so an exact-string match
 * against the constant would miss — regex substring match instead. */
const verificationCheckboxName = new RegExp(AI_VERIFICATION_COPY);

/** Wires `open`/`onOpenChange` the way a real list page does, so closing via
 * Cancel/Escape/overlay-click and reopening exercises the dialog's actual
 * `resetForm()` path instead of bypassing it with a direct prop flip. */
function ControlledDialog(
  props: Omit<Parameters<typeof RequestEnableDialog>[0], "open" | "onOpenChange">
) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <RequestEnableDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

const environments: EnvironmentOption[] = [
  { id: "env-1", code: "staging", name: "Staging" },
  { id: "env-2", code: "production", name: "Production" },
];

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /target environment/i }));
  await user.click(screen.getByRole("option", { name: "Staging" }));
  await user.type(screen.getByLabelText(/start date/i), "2026-09-01");
  await user.type(
    screen.getByLabelText(/business justification/i),
    "Rolling out the new tier structure to staging for QA."
  );
  return user;
}

describe("RequestEnableDialog — interim attestation in requestReason", () => {
  it("appends the attestation line to reason when the checkbox is checked and submitted", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="event-rule"
        entityId="er-1"
        entityName="Welcome Bonus Rule"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const user = await fillRequiredFields();
    await user.click(screen.getByRole("checkbox", { name: verificationCheckboxName }));
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0] as { reason: string };
    expect(submitted.reason).toContain("Rolling out the new tier structure to staging for QA.");
    expect(submitted.reason).toContain(AI_VERIFICATION_COPY);
  });

  it("does not append the attestation line for entity types that don't require verification", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="tier"
        entityId="tier-1"
        entityName="Gold Tier"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const user = await fillRequiredFields();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0] as { reason: string };
    expect(submitted.reason).not.toContain(AI_VERIFICATION_COPY);
  });

  it("rejects a submission whose reason already claims verification for a non-gated entity type", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="tier"
        entityId="tier-1"
        entityName="Gold Tier"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /target environment/i }));
    await user.click(screen.getByRole("option", { name: "Staging" }));
    await user.type(screen.getByLabelText(/start date/i), "2026-09-01");
    await user.type(
      screen.getByLabelText(/business justification/i),
      `Forged: ${AI_VERIFICATION_COPY}`
    );
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot include/i);
  });

  it("does not duplicate the attestation when the reason already contains it", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="event-rule"
        entityId="er-1"
        entityName="Welcome Bonus Rule"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /target environment/i }));
    await user.click(screen.getByRole("option", { name: "Staging" }));
    await user.type(screen.getByLabelText(/start date/i), "2026-09-01");
    await user.type(
      screen.getByLabelText(/business justification/i),
      `Already attested.\n\n${AI_VERIFICATION_COPY}`
    );
    await user.click(screen.getByRole("checkbox", { name: verificationCheckboxName }));
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0] as { reason: string };
    expect(submitted.reason.split(AI_VERIFICATION_COPY)).toHaveLength(2);
  });
});

describe("RequestEnableDialog — handleSubmit blocks an unverified submission", () => {
  it("does not call onSubmit when the form is submitted directly while the checkbox is unchecked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="event-rule"
        entityId="er-1"
        entityName="Welcome Bonus Rule"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    await fillRequiredFields();
    // Bypass the disabled Submit button entirely and fire the form's submit
    // event directly, so this test proves handleSubmit's own guard blocks
    // the request rather than relying solely on the button's disabled state.
    // The dialog renders into a Radix portal outside the render container,
    // so query from document rather than the returned `container`.
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed and verified/i);
  });
});

describe("RequestEnableDialog — AI output verification checkbox", () => {
  it("renders and requires the checkbox for event-rule", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="event-rule"
        entityId="er-1"
        entityName="Welcome Bonus Rule"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(AI_VERIFICATION_COPY)).toBeInTheDocument();

    await fillRequiredFields();
    expect(screen.getByRole("button", { name: /submit request/i })).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: verificationCheckboxName }));
    expect(screen.getByRole("button", { name: /submit request/i })).toBeEnabled();
  });

  it("renders and requires the checkbox for customer-audience", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="customer-audience"
        entityId="aud-1"
        entityName="High Value Customers"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(AI_VERIFICATION_COPY)).toBeInTheDocument();

    await fillRequiredFields();
    expect(screen.getByRole("button", { name: /submit request/i })).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: verificationCheckboxName }));
    expect(screen.getByRole("button", { name: /submit request/i })).toBeEnabled();
  });

  it("does not render the checkbox for other entity types and does not gate Submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestEnableDialog
        entityType="tier"
        entityId="tier-1"
        entityName="Gold Tier"
        environments={environments}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByText(AI_VERIFICATION_COPY)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await fillRequiredFields();
    expect(screen.getByRole("button", { name: /submit request/i })).toBeEnabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("resets the checkbox to unchecked when reopened for a new submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ControlledDialog
        entityType="event-rule"
        entityId="er-1"
        entityName="Welcome Bonus Rule"
        environments={environments}
        onSubmit={onSubmit}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: verificationCheckboxName }));
    expect(screen.getByRole("checkbox", { name: verificationCheckboxName })).toBeChecked();

    // Cancel closes the dialog through the real handleClose -> resetForm path.
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    // Reopen for a new submission — the dialog unmounted rather than staying
    // hidden, so ControlledDialog's `open` state needs to flip back; simulate
    // the parent reopening it for a fresh request.
    await user.click(screen.getByRole("button", { name: /reopen/i }));
    expect(screen.getByRole("checkbox", { name: verificationCheckboxName })).not.toBeChecked();
  });
});
