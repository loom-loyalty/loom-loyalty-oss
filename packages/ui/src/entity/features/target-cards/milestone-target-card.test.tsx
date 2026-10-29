import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  mockMilestoneProgress,
  mockMilestoneProgressComplete,
  mockMilestoneProgressNotStarted,
  mockMilestoneTarget,
} from "../__mocks__/target-mocks";
import { MilestoneTargetCard } from "./milestone-target-card";
import type { TargetProgress } from "./types";

describe("MilestoneTargetCard", () => {
  describe("Rendering", () => {
    it("renders target name", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      expect(screen.getByText("Loyalty Journey")).toBeInTheDocument();
    });

    it("renders target description when available", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      expect(
        screen.getByText("Progress through 5 milestones to unlock rewards")
      ).toBeInTheDocument();
    });

    it("renders target code badge", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      expect(screen.getByText("loyalty-journey")).toBeInTheDocument();
    });

    it("renders without description when not provided", () => {
      const targetWithoutDesc = { ...mockMilestoneTarget, description: undefined };
      render(<MilestoneTargetCard target={targetWithoutDesc} />);
      expect(screen.getByText("Loyalty Journey")).toBeInTheDocument();
      expect(
        screen.queryByText("Progress through 5 milestones to unlock rewards")
      ).not.toBeInTheDocument();
    });
  });

  describe("Progress Display", () => {
    it("renders progress badge with milestone count", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      expect(screen.getByText("2/5")).toBeInTheDocument();
    });

    it("renders stepped progress indicator", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      // Should have 5 step circles for 5 milestones
      const steps = container.querySelectorAll("[role='listitem']");
      expect(steps).toHaveLength(5);
    });

    it("shows 0/5 when not started", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressNotStarted}
        />
      );
      expect(screen.getByText("0/5")).toBeInTheDocument();
    });

    it("shows 5/5 when complete", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressComplete}
        />
      );
      expect(screen.getByText("5/5")).toBeInTheDocument();
    });

    it("shows current milestone name when provided", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      expect(screen.getByText("Regular")).toBeInTheDocument();
      expect(screen.getByText("Current:")).toBeInTheDocument();
    });

    it("does not show current milestone name when achieved", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressComplete}
        />
      );
      expect(screen.queryByText("Current:")).not.toBeInTheDocument();
    });
  });

  describe("Step Indicators", () => {
    it("marks completed milestones with check icon", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      // First 2 milestones should be completed (checkmark icons)
      const checkIcons = container.querySelectorAll(".bg-success");
      expect(checkIcons.length).toBeGreaterThanOrEqual(2);
    });

    it("shows current milestone with pulsing animation", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      const pulsing = container.querySelector(".animate-ping");
      expect(pulsing).toBeInTheDocument();
    });

    it("marks pending milestones with border style", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      // Milestones 4 and 5 should be pending (have border)
      const pendingSteps = container.querySelectorAll(".border-border");
      expect(pendingSteps.length).toBeGreaterThan(0);
    });
  });

  describe("Status States", () => {
    it("shows 'In Progress' status", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });

    it("shows 'Achieved' status when complete", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressComplete}
        />
      );
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("shows 'Not Started' status when no progress", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressNotStarted}
        />
      );
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("shows 'Expired' status when expired", () => {
      const expiredProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno3",
        customerId: "cust_123",
        status: "expired",
        currentMilestoneIndex: 2,
        totalMilestones: 5,
      };
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={expiredProgress} />);
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("applies success styling when achieved", () => {
      const { container } = render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgressComplete}
        />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("bg-success/5");
    });

    it("applies default styling when not achieved", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("bg-success/5");
    });
  });

  describe("Compact Variant", () => {
    it("renders compact variant correctly", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgress}
          variant="compact"
        />
      );
      expect(screen.getByText("Loyalty Journey")).toBeInTheDocument();
      expect(screen.getByText("2 of 5")).toBeInTheDocument();
    });

    it("shows mini step indicator in compact variant", () => {
      const { container } = render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgress}
          variant="compact"
        />
      );
      // Mini dots instead of full steps
      const miniDots = container.querySelectorAll(".h-2.w-2");
      expect(miniDots.length).toBeGreaterThan(0);
    });

    it("does not show description in compact variant", () => {
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgress}
          variant="compact"
        />
      );
      expect(
        screen.queryByText("Progress through 5 milestones to unlock rewards")
      ).not.toBeInTheDocument();
    });

    it("truncates display when more than 5 milestones in compact", () => {
      const manyMilestonesProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno3",
        customerId: "cust_123",
        status: "in_progress",
        currentMilestoneIndex: 3,
        totalMilestones: 10,
      };
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={manyMilestonesProgress}
          variant="compact"
        />
      );
      // Should show "+5" for remaining milestones
      expect(screen.getByText("+5")).toBeInTheDocument();
    });
  });

  describe("Interactivity", () => {
    it("calls onClick when card is clicked", () => {
      const handleClick = vi.fn();
      render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          progress={mockMilestoneProgress}
          onClick={handleClick}
        />
      );
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies cursor-pointer when onClick is provided", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} onClick={() => {}} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("cursor-pointer");
    });

    it("does not apply cursor-pointer when onClick is not provided", () => {
      const { container } = render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Accessibility", () => {
    it("has role='article'", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });

    it("has descriptive aria-label with target name, progress, and status", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute(
        "aria-label",
        "Loyalty Journey target - Milestone 2 of 5 - In Progress"
      );
    });

    it("has progress list with proper ARIA attributes", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      const progressList = screen.getByRole("list", { name: "Milestone progress" });
      expect(progressList).toBeInTheDocument();
    });

    it("has aria-label on each milestone step", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      const steps = screen.getAllByRole("listitem");
      steps.forEach((step) => {
        expect(step).toHaveAttribute("aria-label");
      });
    });

    it("has aria-hidden on decorative icons", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />
      );
      const icons = container.querySelectorAll("svg[aria-hidden='true']");
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles single milestone edge case", () => {
      const singleMilestoneProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno3",
        customerId: "cust_123",
        status: "not_started",
        currentMilestoneIndex: 0,
        totalMilestones: 1,
      };
      render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={singleMilestoneProgress} />
      );
      expect(screen.getByText("0/1")).toBeInTheDocument();
    });

    it("handles zero milestones gracefully", () => {
      const zeroMilestonesProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno3",
        customerId: "cust_123",
        status: "not_started",
        currentMilestoneIndex: 0,
        totalMilestones: 0,
      };
      render(
        <MilestoneTargetCard target={mockMilestoneTarget} progress={zeroMilestonesProgress} />
      );
      expect(screen.getByText("0/0")).toBeInTheDocument();
    });

    it("renders with no progress data", () => {
      render(<MilestoneTargetCard target={mockMilestoneTarget} />);
      // Should default to 0 progress and use target.items.length for total
      expect(screen.getByRole("article")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to default variant", () => {
      const { container } = render(
        <MilestoneTargetCard target={mockMilestoneTarget} className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });

    it("applies custom className to compact variant", () => {
      const { container } = render(
        <MilestoneTargetCard
          target={mockMilestoneTarget}
          variant="compact"
          className="custom-class"
        />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });
  });
});
