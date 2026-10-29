/**
 * TierList Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockEmptyTiers, mockManyTiers, mockTiers } from "./__mocks__/tier-mocks.js";
import { TierList } from "./tier-list.js";

describe("TierList", () => {
  describe("Rendering", () => {
    it("renders tiers in rank order (lowest rank first)", () => {
      render(<TierList tiers={mockTiers} />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(4);
      // First tier should be rank 1 (Platinum)
      expect(items[0]).toHaveAttribute("aria-label", "Platinum tier, ranked 1");
    });

    it("renders empty state when no tiers provided", () => {
      render(<TierList tiers={mockEmptyTiers} />);
      expect(screen.getByText("No tiers configured yet")).toBeInTheDocument();
    });

    it("renders loading skeleton when isLoading=true", () => {
      render(<TierList tiers={mockTiers} isLoading />);
      expect(screen.getByRole("list", { name: "Loading tiers" })).toBeInTheDocument();
    });

    it("renders tier names correctly", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("Platinum")).toBeInTheDocument();
      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.getByText("Silver")).toBeInTheDocument();
      expect(screen.getByText("Bronze")).toBeInTheDocument();
    });

    it("renders tier codes", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("platinum")).toBeInTheDocument();
      expect(screen.getByText("gold")).toBeInTheDocument();
    });

    it("renders duration period when provided", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getAllByText(/Duration: 12 months/i)).toHaveLength(4);
    });

    it("renders subscription badge for subscription tiers", () => {
      const subscriptionTier = { ...mockTiers[0]!, subscription: true };
      render(<TierList tiers={[subscriptionTier]} />);
      expect(screen.getByText("Subscription")).toBeInTheDocument();
    });

    it("renders heading", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByRole("heading", { name: "Tiers" })).toBeInTheDocument();
    });
  });

  describe("Ranking badges", () => {
    it("renders gold badge for rank 1", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("1st")).toBeInTheDocument();
    });

    it("renders silver badge for rank 2", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("2nd")).toBeInTheDocument();
    });

    it("renders bronze badge for rank 3", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("3rd")).toBeInTheDocument();
    });

    it("renders neutral badge for rank 4+", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByText("4th")).toBeInTheDocument();
    });
  });

  describe("Drag and drop", () => {
    it("renders drag handle when canReorder=true", () => {
      const handleReorder = vi.fn();
      render(<TierList tiers={mockTiers} canReorder onReorder={handleReorder} />);
      expect(screen.getByLabelText("Reorder Platinum")).toBeInTheDocument();
    });

    it("hides drag handle when canReorder=false", () => {
      render(<TierList tiers={mockTiers} canReorder={false} />);
      expect(screen.queryByLabelText("Reorder Platinum")).not.toBeInTheDocument();
    });

    it("hides drag handle when onReorder is not provided", () => {
      render(<TierList tiers={mockTiers} canReorder />);
      expect(screen.queryByLabelText("Reorder Platinum")).not.toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("calls onTierClick when tier card is clicked", () => {
      const handleClick = vi.fn();
      render(<TierList tiers={mockTiers} onTierClick={handleClick} />);
      // When onTierClick is provided, tier cards become buttons for accessibility
      fireEvent.click(screen.getByRole("button", { name: /platinum tier, ranked 1/i }));
      expect(handleClick).toHaveBeenCalledWith(mockTiers[0]);
    });

    it("calls onTierClick when Enter key is pressed on tier card", () => {
      const handleClick = vi.fn();
      render(<TierList tiers={mockTiers} onTierClick={handleClick} />);
      const tierButton = screen.getByRole("button", { name: /platinum tier, ranked 1/i });
      fireEvent.keyDown(tierButton, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledWith(mockTiers[0]);
    });

    it("calls onTierClick when Space key is pressed on tier card", () => {
      const handleClick = vi.fn();
      render(<TierList tiers={mockTiers} onTierClick={handleClick} />);
      const tierButton = screen.getByRole("button", { name: /platinum tier, ranked 1/i });
      fireEvent.keyDown(tierButton, { key: " " });
      expect(handleClick).toHaveBeenCalledWith(mockTiers[0]);
    });

    it("renders create button when onCreateClick is provided", () => {
      const handleCreate = vi.fn();
      render(<TierList tiers={mockTiers} onCreateClick={handleCreate} />);
      const createButton = screen.getByRole("button", { name: /add tier/i });
      expect(createButton).toBeInTheDocument();
    });

    it("calls onCreateClick when create button is clicked", () => {
      const handleCreate = vi.fn();
      render(<TierList tiers={mockTiers} onCreateClick={handleCreate} />);
      fireEvent.click(screen.getByRole("button", { name: /add tier/i }));
      expect(handleCreate).toHaveBeenCalled();
    });

    it("shows create button in empty state", () => {
      const handleCreate = vi.fn();
      render(<TierList tiers={mockEmptyTiers} onCreateClick={handleCreate} />);
      expect(screen.getByRole("button", { name: /create your first tier/i })).toBeInTheDocument();
    });

    it("renders action menu trigger when canEdit=true", () => {
      const handleEdit = vi.fn();
      render(<TierList tiers={mockTiers} canEdit onEditClick={handleEdit} />);
      // Action buttons are hidden by default, shown on hover
      const actionButtons = screen.getAllByLabelText(/actions for/i);
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it("renders action menu trigger when canDelete=true", () => {
      const handleDelete = vi.fn();
      render(<TierList tiers={mockTiers} canDelete onDeleteClick={handleDelete} />);
      // Action buttons are hidden by default, shown on hover
      const actionButtons = screen.getAllByLabelText(/actions for/i);
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it("does not render action menu when canEdit=false and canDelete=false", () => {
      render(<TierList tiers={mockTiers} canEdit={false} canDelete={false} />);
      expect(screen.queryByLabelText(/actions for/i)).not.toBeInTheDocument();
    });

    it("action trigger has correct aria attributes", () => {
      const handleEdit = vi.fn();
      render(<TierList tiers={mockTiers} canEdit onEditClick={handleEdit} />);
      const actionButton = screen.getByLabelText("Actions for Platinum");
      expect(actionButton).toHaveAttribute("aria-haspopup", "menu");
    });
  });

  describe("Entity overrides", () => {
    it("shows action menu when canEdit=true and canDelete=false", () => {
      const handleEdit = vi.fn();
      render(<TierList tiers={mockTiers} canEdit canDelete={false} onEditClick={handleEdit} />);
      // Action trigger should still be visible
      expect(screen.getByLabelText("Actions for Platinum")).toBeInTheDocument();
    });

    it("shows action menu when canEdit=false and canDelete=true", () => {
      const handleDelete = vi.fn();
      render(<TierList tiers={mockTiers} canEdit={false} canDelete onDeleteClick={handleDelete} />);
      // Action trigger should still be visible
      expect(screen.getByLabelText("Actions for Platinum")).toBeInTheDocument();
    });

    it("hides action menu when both canEdit and canDelete are false", () => {
      render(<TierList tiers={mockTiers} canEdit={false} canDelete={false} />);
      // Action trigger should not be visible
      expect(screen.queryByLabelText("Actions for Platinum")).not.toBeInTheDocument();
    });
  });

  describe("Extension points", () => {
    it("uses renderTierCard for custom rendering when provided", () => {
      const customRender = vi.fn((_tier, defaultRender) => (
        <div data-testid="custom-tier">{defaultRender}</div>
      ));
      render(<TierList tiers={mockTiers} renderTierCard={customRender} />);

      expect(customRender).toHaveBeenCalledTimes(4);
      expect(screen.getAllByTestId("custom-tier")).toHaveLength(4);
    });
  });

  describe("Accessibility", () => {
    it('has role="list" on container', () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByRole("list", { name: "Tiers" })).toBeInTheDocument();
    });

    it('has role="listitem" on each tier card', () => {
      render(<TierList tiers={mockTiers} />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(4);
    });

    it("has aria-label describing tier for screen readers", () => {
      render(<TierList tiers={mockTiers} />);
      expect(screen.getByLabelText("Platinum tier, ranked 1")).toBeInTheDocument();
      expect(screen.getByLabelText("Gold tier, ranked 2")).toBeInTheDocument();
    });
  });

  describe("Many tiers", () => {
    it("renders all tiers when there are many", () => {
      render(<TierList tiers={mockManyTiers} />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(10);
    });
  });
});
