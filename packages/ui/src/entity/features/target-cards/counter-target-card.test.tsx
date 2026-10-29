import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  mockCounterProgress,
  mockCounterProgressComplete,
  mockCounterProgressZero,
  mockCounterTarget,
} from "../__mocks__/target-mocks";
import { CounterTargetCard } from "./counter-target-card";
import type { TargetProgress } from "./types";

describe("CounterTargetCard", () => {
  describe("Rendering", () => {
    it("renders target name", () => {
      render(<CounterTargetCard target={mockCounterTarget} />);
      expect(screen.getByText("Spend $500")).toBeInTheDocument();
    });

    it("renders target description when available", () => {
      render(<CounterTargetCard target={mockCounterTarget} />);
      expect(screen.getByText("Spend $500 to earn bonus points")).toBeInTheDocument();
    });

    it("renders target code badge", () => {
      render(<CounterTargetCard target={mockCounterTarget} />);
      expect(screen.getByText("spend-500")).toBeInTheDocument();
    });

    it("renders without description when not provided", () => {
      const targetWithoutDesc = { ...mockCounterTarget, description: undefined };
      render(<CounterTargetCard target={targetWithoutDesc} />);
      expect(screen.getByText("Spend $500")).toBeInTheDocument();
      expect(screen.queryByText("Spend $500 to earn bonus points")).not.toBeInTheDocument();
    });
  });

  describe("Progress Display", () => {
    it("renders progress bar", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("renders current/target display", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      expect(screen.getByText("350 / 500")).toBeInTheDocument();
    });

    it("renders percentage badge", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      // 350/500 = 70%
      expect(screen.getByText("70%")).toBeInTheDocument();
    });

    it("shows 0% when no progress", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressZero} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows 100% when complete", () => {
      render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressComplete} />
      );
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("shows 'to go' message when in progress", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      // 500 - 350 = 150
      expect(screen.getByText("150 to go")).toBeInTheDocument();
    });

    it("does not show 'to go' message when complete", () => {
      render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressComplete} />
      );
      expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
    });
  });

  describe("Large Numbers", () => {
    it("formats large numbers with commas", () => {
      const progressWithLargeNumbers: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno2",
        customerId: "cust_123",
        status: "in_progress",
        currentValue: 1500000,
        targetValue: 2000000,
      };
      render(<CounterTargetCard target={mockCounterTarget} progress={progressWithLargeNumbers} />);
      expect(screen.getByText("1,500,000 / 2,000,000")).toBeInTheDocument();
    });
  });

  describe("Cycles Indicator", () => {
    it("renders cycles indicator when cycles are present", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      expect(screen.getByText("Cycles completed")).toBeInTheDocument();
      expect(screen.getByText("2 of 4 cycles")).toBeInTheDocument();
    });

    it("shows correct number of completed cycle indicators", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />
      );
      // Should have 4 cycle indicators (totalCycles = 4)
      const cycleIndicators = container.querySelectorAll(".rounded-full.w-6.h-6");
      expect(cycleIndicators).toHaveLength(4);
    });

    it("does not render cycles when target has no cycles", () => {
      const targetWithoutCycles = { ...mockCounterTarget, numberOfCycles: undefined };
      const progressWithoutCycles: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno2",
        customerId: "cust_123",
        status: "in_progress",
        currentValue: 350,
        targetValue: 500,
      };
      render(<CounterTargetCard target={targetWithoutCycles} progress={progressWithoutCycles} />);
      expect(screen.queryByText("Cycles completed")).not.toBeInTheDocument();
    });
  });

  describe("Status States", () => {
    it("shows 'In Progress' status", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });

    it("shows 'Achieved' status when complete", () => {
      render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressComplete} />
      );
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("shows 'Not Started' status when no progress", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressZero} />);
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("shows 'Expired' status when expired", () => {
      const expiredProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno2",
        customerId: "cust_123",
        status: "expired",
        currentValue: 200,
        targetValue: 500,
      };
      render(<CounterTargetCard target={mockCounterTarget} progress={expiredProgress} />);
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("applies success styling when achieved", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgressComplete} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("bg-success/5");
    });

    it("applies default styling when not achieved", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("bg-success/5");
    });
  });

  describe("Compact Variant", () => {
    it("renders compact variant correctly", () => {
      render(
        <CounterTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          variant="compact"
        />
      );
      expect(screen.getByText("Spend $500")).toBeInTheDocument();
      expect(screen.getByText("350 / 500")).toBeInTheDocument();
    });

    it("shows circular progress indicator in compact variant", () => {
      const { container } = render(
        <CounterTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          variant="compact"
        />
      );
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("does not show description in compact variant", () => {
      render(
        <CounterTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          variant="compact"
        />
      );
      expect(screen.queryByText("Spend $500 to earn bonus points")).not.toBeInTheDocument();
    });

    it("does not show cycles in compact variant", () => {
      render(
        <CounterTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          variant="compact"
        />
      );
      expect(screen.queryByText("Cycles completed")).not.toBeInTheDocument();
    });
  });

  describe("Interactivity", () => {
    it("calls onClick when card is clicked", () => {
      const handleClick = vi.fn();
      render(
        <CounterTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          onClick={handleClick}
        />
      );
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies cursor-pointer when onClick is provided", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} onClick={() => {}} />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("cursor-pointer");
    });

    it("does not apply cursor-pointer when onClick is not provided", () => {
      const { container } = render(<CounterTargetCard target={mockCounterTarget} />);
      const article = container.querySelector("[role='article']");
      expect(article).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Accessibility", () => {
    it("has role='article'", () => {
      render(<CounterTargetCard target={mockCounterTarget} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });

    it("has descriptive aria-label with target name, progress, and status", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", "Spend $500 target - 350 of 500 - In Progress");
    });

    it("has progress bar with proper ARIA attributes", () => {
      render(<CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "350");
      expect(progressbar).toHaveAttribute("aria-valuemin", "0");
      expect(progressbar).toHaveAttribute("aria-valuemax", "500");
    });

    it("has aria-hidden on decorative icons", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} progress={mockCounterProgress} />
      );
      const icons = container.querySelectorAll("svg[aria-hidden='true']");
      // Cycle indicators use SVG icons
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero target value gracefully", () => {
      const targetWithZero = { ...mockCounterTarget, targetValue: 0 };
      const progressWithZero: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno2",
        customerId: "cust_123",
        status: "not_started",
        currentValue: 0,
        targetValue: 0,
      };
      render(<CounterTargetCard target={targetWithZero} progress={progressWithZero} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("clamps percentage at 100% for overflow", () => {
      const overflowProgress: TargetProgress = {
        targetId: "targ_abc123def456ghi789jkl012mno2",
        customerId: "cust_123",
        status: "achieved",
        currentValue: 600, // More than target
        targetValue: 500,
      };
      render(<CounterTargetCard target={mockCounterTarget} progress={overflowProgress} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to default variant", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });

    it("applies custom className to compact variant", () => {
      const { container } = render(
        <CounterTargetCard target={mockCounterTarget} variant="compact" className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });
  });
});
