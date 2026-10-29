/**
 * ActivityDescriptionBox behavior suite.
 *
 * The box is an assist, never a gate: every state below must leave the rest of
 * the Record activity surface usable, and every outcome the model produces has
 * to reach a screen-reader user as well as a sighted one.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityDescriptionBox } from "../record-activity/activity-description-box.js";

function renderBox(overrides: Partial<Parameters<typeof ActivityDescriptionBox>[0]> = {}) {
  const onChange = vi.fn();
  const onSuggest = vi.fn();
  const result = render(
    <ActivityDescriptionBox
      value="Two nights at the Riverside"
      onChange={onChange}
      onSuggest={onSuggest}
      {...overrides}
    />
  );
  return { ...result, onChange, onSuggest };
}

describe("ActivityDescriptionBox", () => {
  it("asks the assistant for a match when the agent presses the button", () => {
    const { onSuggest } = renderBox();

    fireEvent.click(screen.getByRole("button", { name: /Suggest a match/ }));

    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it("offers nothing to read when the box is empty", () => {
    renderBox({ value: "   " });

    expect(screen.getByRole("button", { name: /Suggest a match/ })).toBeDisabled();
  });
});

describe("ActivityDescriptionBox: while the assistant is reading", () => {
  it("keeps the textarea focusable rather than disabling it under the agent", () => {
    // Disabling a control that currently holds focus throws focus to <body>
    // with nothing to restore it. readOnly refuses edits and keeps focus.
    renderBox({ loading: true });

    const textarea = screen.getByLabelText("Describe what happened");
    expect(textarea).not.toBeDisabled();
    expect(textarea).toHaveAttribute("readonly");
    expect(textarea).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the button focusable but refuses the click", () => {
    // The agent just clicked this button, so focus is on it. Disabling it here
    // is exactly the case that loses focus.
    const { onSuggest } = renderBox({ loading: true });

    const button = screen.getByRole("button", { name: /Thinking/ });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(onSuggest).not.toHaveBeenCalled();
  });

  it("says it is working", () => {
    renderBox({ loading: true });

    expect(screen.getByRole("button", { name: /Thinking/ })).toBeInTheDocument();
  });
});

describe("ActivityDescriptionBox: what the assistant came back with", () => {
  it("announces an abstain instead of only painting it", () => {
    // The callout appears without the agent doing anything further, so it has
    // to reach a screen reader even when the caller wires no announcement.
    renderBox({ noMatch: true });

    // Two status nodes are correct here: the always-mounted live region and the
    // callout itself. Pick the callout rather than assuming there is only one.
    const callout = screen
      .getAllByRole("status")
      .find((node) => node.textContent?.includes("No clear match"));

    expect(callout).toBeDefined();
    expect(callout).toHaveTextContent(/Nothing in the list clearly matches that/);
  });

  it("surfaces assumptions for the agent to check", () => {
    renderBox({ assumptions: ["Read “the Riverside” as the Riverside property."] });

    const note = screen.getByRole("note", { name: "Assumptions the assistant made" });
    expect(note).toHaveTextContent("Read “the Riverside” as the Riverside property.");
  });

  it("reports a failure without touching what the agent typed", () => {
    renderBox({ error: "That could not be read just now." });

    expect(screen.getByRole("alert")).toHaveTextContent("That could not be read just now.");
    expect((screen.getByLabelText("Describe what happened") as HTMLTextAreaElement).value).toBe(
      "Two nights at the Riverside"
    );
  });

  it("prefers the error over the abstain callout when both could show", () => {
    renderBox({ error: "That could not be read just now.", noMatch: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing in the list clearly matches that/)).not.toBeInTheDocument();
  });

  it("announces what changed elsewhere when the caller supplies it", () => {
    // A match reorders the picker and seeds detail values, neither of which is
    // inside this component, so only the caller can describe it.
    renderBox({ resultAnnouncement: "Suggested Hotel stay. Review and choose it to continue." });

    expect(
      screen.getByText("Suggested Hotel stay. Review and choose it to continue.")
    ).toBeInTheDocument();
  });

  it("keeps the live region mounted while silent, so later messages announce", () => {
    // A live region added to the DOM at the same moment as its text is
    // unreliable: screen readers may miss it. It has to be there in advance.
    const { container } = renderBox();

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent("");
  });
});

describe("ActivityDescriptionBox: when the assistant is unavailable", () => {
  it("explains itself and points at the list, without an input to fill", () => {
    renderBox({ unavailable: true });

    expect(screen.getByRole("status")).toHaveTextContent(/unavailable right now/);
    expect(screen.queryByLabelText("Describe what happened")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suggest a match/ })).not.toBeInTheDocument();
  });
});
