import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SavedViewsMenu } from "./saved-views-menu";
import type { SavedView } from "./saved-views-store";

const sample: SavedView[] = [
  { id: "1", name: "Active", search: { status: "ACTIVE" }, createdAt: 1 },
  { id: "2", name: "Drafts", search: { status: "DRAFT" }, createdAt: 2 },
];

describe("SavedViewsMenu", () => {
  it("labels the trigger 'Saved views' when no view is active", () => {
    render(
      <SavedViewsMenu
        views={sample}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
        onSaveCurrent={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Saved views" })).toBeInTheDocument();
  });

  it("labels the trigger with the active view's name", () => {
    render(
      <SavedViewsMenu
        views={sample}
        activeViewId="1"
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
        onSaveCurrent={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Saved view: Active/ })).toBeInTheDocument();
  });

  it("calls onApplyView with the chosen view id", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SavedViewsMenu
        views={sample}
        onApplyView={onApply}
        onDeleteView={vi.fn()}
        onSaveCurrent={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Saved views" }));
    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(onApply).toHaveBeenCalledWith("1");
  });

  it("calls onDeleteView when the row × is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <SavedViewsMenu
        views={sample}
        onApplyView={vi.fn()}
        onDeleteView={onDelete}
        onSaveCurrent={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Saved views" }));
    await user.click(screen.getByRole("button", { name: "Delete view Active" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("submits a name via the Save flow", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <SavedViewsMenu
        views={[]}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
        onSaveCurrent={onSave}
      />
    );
    await user.click(screen.getByRole("button", { name: "Saved views" }));
    await user.type(screen.getByLabelText(/save current view/i), "New View");
    await user.click(screen.getByRole("button", { name: "Save view" }));
    expect(onSave).toHaveBeenCalledWith("New View");
  });

  it("shows the save-disabled hint when canSave is false", async () => {
    const user = userEvent.setup();
    render(
      <SavedViewsMenu
        views={[]}
        canSave={false}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
        onSaveCurrent={vi.fn()}
        saveDisabledHint="Type something first."
      />
    );
    await user.click(screen.getByRole("button", { name: "Saved views" }));
    expect(screen.getByText("Type something first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save view" })).not.toBeInTheDocument();
  });

  it("marks the active view button as aria-pressed", async () => {
    const user = userEvent.setup();
    render(
      <SavedViewsMenu
        views={sample}
        activeViewId="1"
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
        onSaveCurrent={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /Saved view: Active/ }));
    expect(screen.getByRole("button", { name: "Active", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drafts", pressed: false })).toBeInTheDocument();
  });
});
