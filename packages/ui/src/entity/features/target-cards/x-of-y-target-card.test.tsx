import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  mockXOfYProgress,
  mockXOfYProgressComplete,
  mockXOfYProgressNotStarted,
  mockXOfYTarget,
} from "../__mocks__/target-mocks";
import type { TargetProgress } from "./types";
import { XOfYTargetCard } from "./x-of-y-target-card";

describe("XOfYTargetCard", () => {
  describe("Rendering", () => {
    it("renders target name", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} />);
      expect(screen.getByText("Product Explorer")).toBeInTheDocument();
    });

    it("renders target description when available", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} />);
      expect(screen.getByText("Try 3 out of 5 featured products")).toBeInTheDocument();
    });

    it("renders target code badge", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} />);
      expect(screen.getByText("try-3-products")).toBeInTheDocument();
    });

    it("renders without description when not provided", () => {
      const targetWithoutDesc = { ...mockXOfYTarget, description: undefined };
      render(<XOfYTargetCard target={targetWithoutDesc} />);
      expect(screen.getByText("Product Explorer")).toBeInTheDocument();
      expect(screen.queryByText("Try 3 out of 5 featured products")).not.toBeInTheDocument();
    });
  });

  describe("Progress Display", () => {
    it("renders progress badge with completed/needed count", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });

    it("shows 0/3 when not started", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressNotStarted} />);
      expect(screen.getByText("0/3")).toBeInTheDocument();
    });

    it("shows 3/3 when complete", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressComplete} />);
      expect(screen.getByText("3/3")).toBeInTheDocument();
    });

    it("shows activities completed text", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      expect(screen.getByText("2 of 3 activities completed")).toBeInTheDocument();
    });

    it("shows 'more needed' when incomplete", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      expect(screen.getByText("1 more needed")).toBeInTheDocument();
    });

    it("does not show 'more needed' when achieved", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressComplete} />);
      expect(screen.queryByText(/more needed/)).not.toBeInTheDocument();
    });
  });

  describe("Dot Matrix", () => {
    it("renders dot matrix for small number of items", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />
      );
      // Should have 5 dots for 5 total items
      const dots = container.querySelectorAll(".rounded-full.h-8.w-8");
      expect(dots).toHaveLength(5);
    });

    it("marks completed items with checkmarks", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />
      );
      // 2 items completed should have success styling
      const completedDots = container.querySelectorAll(".bg-success");
      expect(completedDots.length).toBeGreaterThanOrEqual(2);
    });

    it("shows progress bar for large number of items", () => {
      const largeTarget = {
        ...mockXOfYTarget,
        items: Array.from({ length: 25 }, (_, i) => `item-${i}`),
        targetValue: 15,
      };
      const largeProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno4",
        customerId: "cust_123",
        status: "in_progress",
        completedItemIds: Array.from({ length: 10 }, (_, i) => `item-${i}`),
        totalItems: 25,
        itemsNeeded: 15,
      };
      render(<XOfYTargetCard target={largeTarget} progress={largeProgress} />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  describe("Status States", () => {
    it("shows 'In Progress' status", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });

    it("shows 'Achieved' status when complete", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressComplete} />);
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("shows 'Not Started' status when no progress", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressNotStarted} />);
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("shows 'Expired' status when expired", () => {
      const expiredProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno4",
        customerId: "cust_123",
        status: "expired",
        completedItemIds: ["product-a"],
        totalItems: 5,
        itemsNeeded: 3,
      };
      render(<XOfYTargetCard target={mockXOfYTarget} progress={expiredProgress} />);
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("applies success styling when achieved", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgressComplete} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("bg-success/5");
    });

    it("applies default styling when not achieved", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("bg-success/5");
    });
  });

  describe("Compact Variant", () => {
    it("renders compact variant correctly", () => {
      render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} variant="compact" />
      );
      expect(screen.getByText("Product Explorer")).toBeInTheDocument();
      expect(screen.getByText("2 of 3 needed")).toBeInTheDocument();
    });

    it("shows circular progress indicator in compact variant", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} variant="compact" />
      );
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("does not show description in compact variant", () => {
      render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} variant="compact" />
      );
      expect(screen.queryByText("Try 3 out of 5 featured products")).not.toBeInTheDocument();
    });

    it("does not show dot matrix in compact variant", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} variant="compact" />
      );
      // Should not have the large 8x8 dots
      const largeDots = container.querySelectorAll(".h-8.w-8.rounded-full");
      expect(largeDots).toHaveLength(0);
    });
  });

  describe("Interactivity", () => {
    it("calls onClick when card is clicked", () => {
      const handleClick = vi.fn();
      render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} onClick={handleClick} />
      );
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies cursor-pointer when onClick is provided", () => {
      const { container } = render(<XOfYTargetCard target={mockXOfYTarget} onClick={() => {}} />);
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("cursor-pointer");
    });

    it("does not apply cursor-pointer when onClick is not provided", () => {
      const { container } = render(<XOfYTargetCard target={mockXOfYTarget} />);
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Accessibility", () => {
    it("has role='article'", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });

    it("has descriptive aria-label with target name, progress, and status", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute(
        "aria-label",
        "Product Explorer target - 2 of 3 completed - In Progress"
      );
    });

    it("has group with proper ARIA attributes for dot matrix", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      const group = screen.getByRole("group");
      expect(group).toHaveAttribute("aria-label");
    });

    it("has aria-hidden on decorative icons", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />
      );
      const icons = container.querySelectorAll("svg[aria-hidden='true']");
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero items needed gracefully", () => {
      const targetWithZero = { ...mockXOfYTarget, targetValue: 0 };
      const progressWithZero: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno4",
        customerId: "cust_123",
        status: "not_started",
        completedItemIds: [],
        totalItems: 5,
        itemsNeeded: 0,
      };
      render(<XOfYTargetCard target={targetWithZero} progress={progressWithZero} />);
      expect(screen.getByText("0/0")).toBeInTheDocument();
    });

    it("handles more completed than needed", () => {
      const overProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno4",
        customerId: "cust_123",
        status: "achieved",
        completedItemIds: ["a", "b", "c", "d"],
        totalItems: 5,
        itemsNeeded: 3,
      };
      render(<XOfYTargetCard target={mockXOfYTarget} progress={overProgress} />);
      expect(screen.getByText("4/3")).toBeInTheDocument();
    });

    it("renders with no progress data", () => {
      render(<XOfYTargetCard target={mockXOfYTarget} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to default variant", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });

    it("applies custom className to compact variant", () => {
      const { container } = render(
        <XOfYTargetCard target={mockXOfYTarget} variant="compact" className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });
  });
});
