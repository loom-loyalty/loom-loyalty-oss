/**
 * RecordActivityModal behavior suite (U3).
 *
 * The vocabulary assertion at the bottom is the one most likely to erode under
 * later edits: every operator-visible string has to stay in customer-care
 * language, and the dotted activity code must never surface.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordActivityModal } from "../record-activity/record-activity-modal.js";
import type { CareActivityOption } from "../record-activity/types.js";

const ACTIVITIES: CareActivityOption[] = [
  { code: "hotel.stay", name: "Hotel stay" },
  { code: "transaction", name: "Purchase" },
];

type Props = Parameters<typeof RecordActivityModal>[0];

function renderModal(overrides: Partial<Props> = {}) {
  const onOpenChange = vi.fn();
  const onApply = vi.fn();
  const onSelectActivity = vi.fn();
  const onDateChange = vi.fn();

  const props: Props = {
    open: true,
    onOpenChange,
    customerName: "Ada Lovelace",
    activities: ACTIVITIES,
    selectedActivityCode: null,
    onSelectActivity,
    date: "2026-08-14T19:48",
    onDateChange,
    dateLabel: "14 August 2026",
    details: [],
    environmentName: "Production",
    onApply,
    ...overrides,
  };

  const result = render(<RecordActivityModal {...props} />);
  return { ...result, onOpenChange, onApply, onSelectActivity, onDateChange, props };
}

describe("RecordActivityModal", () => {
  it("explains that no activities are configured and names who can configure them", () => {
    // Covers AE1. An empty registry is a real answer, not an error and not an
    // empty control: "nothing configured" and "broken" look identical
    // otherwise.
    renderModal({ activities: [] });

    expect(screen.getByText("No activities are set up for recording yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Your organization administrator can choose which activities appear here.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a failed list read from an empty registry", () => {
    // "Nothing is configured" and "we could not find out" are different facts.
    // Telling an agent the first when the second is true sends them to an
    // administrator who has nothing to fix.
    const onRetryActivities = vi.fn();
    renderModal({ activities: [], activitiesError: true, onRetryActivities });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The list of activities could not be loaded."
    );
    expect(
      screen.queryByText("No activities are set up for recording yet.")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryActivities).toHaveBeenCalledTimes(1);
  });

  it("prefers the empty state when the read succeeded and returned nothing", () => {
    renderModal({ activities: [], activitiesError: false });

    expect(screen.getByText("No activities are set up for recording yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not claim nothing happened while the engine is still processing", () => {
    // An event type without synchronous processing, which is everything the
    // program wizard creates, returns PENDING with no actions yet. Reporting
    // "nothing changed" would have an agent tell the customer the activity did
    // nothing while their rewards were still landing.
    renderModal({
      selectedActivityCode: "hotel.stay",
      applied: true,
      resultActions: [],
      resultPending: true,
    });

    expect(screen.getByRole("status")).toHaveTextContent(/still being processed/i);
    expect(screen.queryByText(/Nothing changed on this customer/)).not.toBeInTheDocument();
  });

  it("says nothing changed only when the engine finished and produced nothing", () => {
    renderModal({
      selectedActivityCode: "hotel.stay",
      applied: true,
      resultActions: [],
      resultPending: false,
    });

    expect(screen.getByText(/Nothing changed on this customer/)).toBeInTheDocument();
  });

  it("shows the actions when there are any, pending flag notwithstanding", () => {
    renderModal({
      selectedActivityCode: "hotel.stay",
      applied: true,
      resultActions: [{ summary: "Added 250 Bean points to their balance" }],
      resultPending: true,
    });

    expect(screen.getByText("Added 250 Bean points to their balance")).toBeInTheDocument();
    expect(screen.queryByText(/still being processed/i)).not.toBeInTheDocument();
  });

  it("does not show the empty state while the offered list is still loading", () => {
    renderModal({ activities: [], activitiesLoading: true });

    expect(
      screen.queryByText("No activities are set up for recording yet.")
    ).not.toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on cancel without submitting", () => {
    const { onOpenChange, onApply } = renderModal({ selectedActivityCode: "hotel.stay" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows the customer and does not offer it as an editable control", () => {
    renderModal();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // The customer is established by the page that opened this modal, so no
    // control anywhere in the dialog carries the name as an editable value.
    const controls = screen
      .getByRole("dialog")
      .querySelectorAll<HTMLInputElement>("input, textarea, select");
    for (const control of controls) {
      expect(control.value).not.toBe("Ada Lovelace");
    }
    expect(screen.queryByLabelText("Customer")).not.toBeInTheDocument();
  });

  it("captures a date AND a time, not a calendar date alone", () => {
    // An event carries an `eventDateTime`. A date-only control forced the app to
    // invent an hour, which both misreported the record back to the customer and
    // could stamp it before the very rule it was meant to trigger.
    const { onDateChange } = renderModal();

    const dateInput = screen.getByLabelText("When it happened") as HTMLInputElement;
    expect(dateInput.type).toBe("datetime-local");
    expect(dateInput.value).toBe("2026-08-14T19:48");
    expect(dateInput).not.toBeDisabled();

    fireEvent.change(dateInput, { target: { value: "2026-08-01T08:15" } });
    expect(onDateChange).toHaveBeenCalledWith("2026-08-01T08:15");
  });

  it("blocks apply on a cleared date, whose consequences are all silent", () => {
    // An empty date degrades three ways at once with nothing on screen saying
    // so: the record is stamped at submission time, the duplicate-record check
    // short-circuits so its warning never appears, and the check panel's "When"
    // row renders blank.
    const { rerender, props } = renderModal({ selectedActivityCode: "hotel.stay" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();

    rerender(<RecordActivityModal {...props} selectedActivityCode="hotel.stay" date="" />);

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByLabelText("When it happened")).toBeRequired();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter when this happened");
  });

  it("keeps apply disabled until an activity is selected", () => {
    const { rerender, props } = renderModal();

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    rerender(<RecordActivityModal {...props} selectedActivityCode="hotel.stay" />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("applies the selected activity when the agent presses the button", () => {
    const { onApply } = renderModal({ selectedActivityCode: "hotel.stay" });

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("renders the details form only once an activity is selected", () => {
    const { rerender, props } = renderModal({
      detailsSlot: <p>Detail fields</p>,
    });

    expect(screen.queryByText("Detail fields")).not.toBeInTheDocument();

    rerender(
      <RecordActivityModal
        {...props}
        detailsSlot={<p>Detail fields</p>}
        selectedActivityCode="hotel.stay"
      />
    );
    expect(screen.getByText("Detail fields")).toBeInTheDocument();
  });

  it("surfaces an error without closing or clearing the entered values", () => {
    const { onOpenChange } = renderModal({
      selectedActivityCode: "hotel.stay",
      error: "That date is in the future.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("That date is in the future.");
    expect((screen.getByLabelText("When it happened") as HTMLInputElement).value).toBe(
      "2026-08-14T19:48"
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a described error's support reference and its field errors in the banner", () => {
    renderModal({
      selectedActivityCode: "hotel.stay",
      error: { message: "Some values are invalid.", requestId: "req-modal-1" },
      fieldErrors: [{ field: "nights", message: "Nights must be at least 1." }],
    });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Some values are invalid.");
    expect(banner).toHaveTextContent("Nights must be at least 1.");
    expect(banner).toHaveTextContent("Reference: req-modal-1");
  });

  it("uses customer-care language throughout, with no engine vocabulary or dotted codes", () => {
    renderModal({
      selectedActivityCode: "hotel.stay",
      details: [{ name: "nights", label: "Nights", value: "2" }],
      earlierRecord: { activityName: "Hotel stay", recordedOn: "14 August 2026" },
    });

    const dialog = screen.getByRole("dialog");
    const text = (dialog.textContent ?? "").toLowerCase();

    expect(text).not.toContain("event");
    expect(text).not.toContain("fire");
    expect(text).not.toContain("publish");
    expect(text).toContain("record activity");

    // No dotted activity code. Checked per text node rather than against the
    // dialog's concatenated textContent, which joins adjacent elements without
    // a separator and so manufactures matches like "catch up." + "Customer".
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
    const dottedCode = /[a-z-]+\.[a-z-]+/;
    let node = walker.nextNode();
    while (node) {
      expect(
        (node.textContent ?? "").toLowerCase(),
        "an operator-visible string contains a dotted activity code"
      ).not.toMatch(dottedCode);
      node = walker.nextNode();
    }
  });
});
