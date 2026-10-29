import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  mockCompletionProgress,
  mockCompletionProgressNotStarted,
  mockCompletionTarget,
} from "../__mocks__/target-mocks";
import { CompletionTargetCard } from "./completion-target-card";
import type { TargetProgress } from "./types";

describe("CompletionTargetCard", () => {
  describe("Rendering", () => {
    it("renders target name", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} />);
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
    });

    it("renders target description when available", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} />);
      expect(screen.getByText("Complete your first purchase")).toBeInTheDocument();
    });

    it("renders target code badge", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} />);
      expect(screen.getByText("first-purchase")).toBeInTheDocument();
    });

    it("renders without description when not provided", () => {
      const targetWithoutDesc = { ...mockCompletionTarget, description: undefined };
      render(<CompletionTargetCard target={targetWithoutDesc} />);
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
      expect(screen.queryByText("Complete your first purchase")).not.toBeInTheDocument();
    });
  });

  describe("Completion State", () => {
    it("renders checkmark icon when complete", () => {
      render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      // The checkmark SVG should be present
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", expect.stringContaining("Achieved"));
    });

    it("renders circle icon when incomplete", () => {
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgressNotStarted}
        />
      );
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", expect.stringContaining("Not Started"));
    });

    it("shows 'Achieved' status when complete", () => {
      render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("shows 'Not Started' status when not complete", () => {
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgressNotStarted}
        />
      );
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("shows 'Not Started' status when no progress provided", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} />);
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("shows completion date when achieved", () => {
      render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      expect(screen.getByText(/Completed/)).toBeInTheDocument();
    });

    it("does not show completion date when not achieved", () => {
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgressNotStarted}
        />
      );
      expect(screen.queryByText(/Completed/)).not.toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("applies success styling when achieved", () => {
      const { container } = render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("bg-success/5");
    });

    it("applies default styling when not achieved", () => {
      const { container } = render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgressNotStarted}
        />
      );
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("bg-success/5");
    });
  });

  describe("Compact Variant", () => {
    it("renders compact variant correctly", () => {
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgress}
          variant="compact"
        />
      );
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("truncates long names in compact variant", () => {
      const longNameTarget = {
        ...mockCompletionTarget,
        name: "A Very Long Target Name That Should Be Truncated",
      };
      const { container } = render(
        <CompletionTargetCard target={longNameTarget} variant="compact" />
      );
      const nameElement = container.querySelector(".truncate");
      expect(nameElement).toBeInTheDocument();
    });

    it("does not show description in compact variant", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} variant="compact" />);
      expect(screen.queryByText("Complete your first purchase")).not.toBeInTheDocument();
    });

    it("does not show code badge in compact variant", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} variant="compact" />);
      expect(screen.queryByText("first-purchase")).not.toBeInTheDocument();
    });
  });

  describe("Interactivity", () => {
    it("calls onClick when card is clicked", () => {
      const handleClick = vi.fn();
      render(<CompletionTargetCard target={mockCompletionTarget} onClick={handleClick} />);
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies cursor-pointer when onClick is provided", () => {
      const { container } = render(
        <CompletionTargetCard target={mockCompletionTarget} onClick={() => {}} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("cursor-pointer");
    });

    it("does not apply cursor-pointer when onClick is not provided", () => {
      const { container } = render(<CompletionTargetCard target={mockCompletionTarget} />);
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("cursor-pointer");
    });

    it("calls onClick in compact variant when card is clicked", () => {
      const handleClick = vi.fn();
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          onClick={handleClick}
          variant="compact"
        />
      );
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has role='article'", () => {
      render(<CompletionTargetCard target={mockCompletionTarget} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });

    it("has descriptive aria-label with target name and status", () => {
      render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", "First Purchase target - Achieved");
    });

    it("has correct aria-label for not started status", () => {
      render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgressNotStarted}
        />
      );
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", "First Purchase target - Not Started");
    });

    it("has aria-hidden on decorative icons", () => {
      const { container } = render(
        <CompletionTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />
      );
      const icons = container.querySelectorAll("svg");
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  describe("Expired Status", () => {
    it("shows 'Expired' status when progress is expired", () => {
      const expiredProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno1",
        customerId: "cust_123",
        status: "expired",
        isComplete: false,
      };
      render(<CompletionTargetCard target={mockCompletionTarget} progress={expiredProgress} />);
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    it("renders circle icon when expired", () => {
      const expiredProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno1",
        customerId: "cust_123",
        status: "expired",
        isComplete: false,
      };
      render(<CompletionTargetCard target={mockCompletionTarget} progress={expiredProgress} />);
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", expect.stringContaining("Expired"));
    });
  });

  describe("In Progress Status", () => {
    it("shows 'In Progress' status correctly", () => {
      const inProgressProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno1",
        customerId: "cust_123",
        status: "in_progress",
        isComplete: false,
      };
      render(<CompletionTargetCard target={mockCompletionTarget} progress={inProgressProgress} />);
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to default variant", () => {
      const { container } = render(
        <CompletionTargetCard target={mockCompletionTarget} className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });

    it("applies custom className to compact variant", () => {
      const { container } = render(
        <CompletionTargetCard
          target={mockCompletionTarget}
          variant="compact"
          className="custom-class"
        />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });
  });
});
