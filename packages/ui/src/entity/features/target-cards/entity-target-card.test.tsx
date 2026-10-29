import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  mockCompletionProgress,
  mockCompletionTarget,
  mockCounterProgress,
  mockCounterTarget,
  mockMilestoneProgress,
  mockMilestoneTarget,
  mockXOfYProgress,
  mockXOfYTarget,
} from "../__mocks__/target-mocks";
import { EntityTargetCard } from "./entity-target-card";

describe("EntityTargetCard", () => {
  describe("Type Discrimination", () => {
    it("renders CompletionTargetCard for type=COMPLETION", () => {
      render(<EntityTargetCard target={mockCompletionTarget} progress={mockCompletionProgress} />);
      // CompletionTargetCard renders checkmark for achieved status
      expect(screen.getByRole("article")).toBeInTheDocument();
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });

    it("renders CounterTargetCard for type=COUNTER", () => {
      render(<EntityTargetCard target={mockCounterTarget} progress={mockCounterProgress} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
      expect(screen.getByText("Spend $500")).toBeInTheDocument();
      // Counter shows progress bar and percentage
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("renders MilestoneTargetCard for type=MILESTONE", () => {
      render(<EntityTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
      expect(screen.getByText("Loyalty Journey")).toBeInTheDocument();
      // Milestone shows stepped progress
      expect(screen.getByRole("list", { name: "Milestone progress" })).toBeInTheDocument();
    });

    it("renders XOfYTargetCard for type=X_OF_Y", () => {
      render(<EntityTargetCard target={mockXOfYTarget} progress={mockXOfYProgress} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
      expect(screen.getByText("Product Explorer")).toBeInTheDocument();
      // X of Y shows dot matrix
      expect(screen.getByRole("group")).toBeInTheDocument();
    });

    it("returns null for unknown target type", () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const unknownTarget = { ...mockCompletionTarget, type: "UNKNOWN" as never };
      const { container } = render(<EntityTargetCard target={unknownTarget} />);
      expect(container.firstChild).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith("[EntityTargetCard] Unknown target type: UNKNOWN");
      consoleWarn.mockRestore();
    });
  });

  describe("Props Forwarding", () => {
    it("forwards onClick to child component", () => {
      const handleClick = vi.fn();
      render(
        <EntityTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgress}
          onClick={handleClick}
        />
      );
      fireEvent.click(screen.getByRole("article"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("forwards variant to child component", () => {
      const { container } = render(
        <EntityTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          variant="compact"
        />
      );
      // Compact variant has different structure
      expect(container.querySelector("svg")).toBeInTheDocument();
      // Should not have the large progress bar of default variant
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("forwards progress to child component", () => {
      render(<EntityTargetCard target={mockMilestoneTarget} progress={mockMilestoneProgress} />);
      // Progress shows 2/5 milestones
      expect(screen.getByText("2/5")).toBeInTheDocument();
    });

    it("forwards className to child component", () => {
      const { container } = render(
        <EntityTargetCard target={mockCompletionTarget} className="custom-class" />
      );
      const article = container.querySelector("[role='article']");
      expect(article).toHaveClass("custom-class");
    });
  });

  describe("Extension Points", () => {
    it("uses renderCard for custom rendering when provided", () => {
      const customRender = vi.fn((_target, _progress, defaultRender) => (
        <div data-testid="custom-wrapper">{defaultRender}</div>
      ));

      render(
        <EntityTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgress}
          renderCard={customRender}
        />
      );

      expect(customRender).toHaveBeenCalledWith(
        mockCompletionTarget,
        mockCompletionProgress,
        expect.anything() // defaultRender is a ReactNode
      );
      expect(screen.getByTestId("custom-wrapper")).toBeInTheDocument();
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
    });

    it("passes correct arguments to renderCard", () => {
      const customRender = vi.fn((_target, _progress, defaultRender) => defaultRender);

      render(
        <EntityTargetCard
          target={mockCounterTarget}
          progress={mockCounterProgress}
          renderCard={customRender}
        />
      );

      expect(customRender).toHaveBeenCalledWith(
        mockCounterTarget,
        mockCounterProgress,
        expect.anything()
      );
    });

    it("allows renderCard to completely replace content", () => {
      const customRender = () => <div data-testid="replacement">Custom Content</div>;

      render(<EntityTargetCard target={mockCompletionTarget} renderCard={customRender} />);

      expect(screen.getByTestId("replacement")).toBeInTheDocument();
      expect(screen.getByText("Custom Content")).toBeInTheDocument();
      expect(screen.queryByText("First Purchase")).not.toBeInTheDocument();
    });
  });

  describe("Completion Target Specific", () => {
    it("renders CompletionTargetCard with all props", () => {
      const handleCelebrate = vi.fn();
      render(
        <EntityTargetCard
          target={mockCompletionTarget}
          progress={mockCompletionProgress}
          onCelebrate={handleCelebrate}
          variant="default"
        />
      );
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
    });
  });

  describe("Without Progress", () => {
    it("renders CompletionTargetCard without progress", () => {
      render(<EntityTargetCard target={mockCompletionTarget} />);
      expect(screen.getByText("First Purchase")).toBeInTheDocument();
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("renders CounterTargetCard without progress", () => {
      render(<EntityTargetCard target={mockCounterTarget} />);
      expect(screen.getByText("Spend $500")).toBeInTheDocument();
    });

    it("renders MilestoneTargetCard without progress", () => {
      render(<EntityTargetCard target={mockMilestoneTarget} />);
      expect(screen.getByText("Loyalty Journey")).toBeInTheDocument();
    });

    it("renders XOfYTargetCard without progress", () => {
      render(<EntityTargetCard target={mockXOfYTarget} />);
      expect(screen.getByText("Product Explorer")).toBeInTheDocument();
    });
  });

  describe("Variant Consistency", () => {
    it("applies compact variant to all target types", () => {
      // Test each type renders compact correctly
      const targets = [
        { target: mockCompletionTarget, name: "First Purchase" },
        { target: mockCounterTarget, name: "Spend $500" },
        { target: mockMilestoneTarget, name: "Loyalty Journey" },
        { target: mockXOfYTarget, name: "Product Explorer" },
      ];

      targets.forEach(({ target, name }) => {
        const { container, unmount } = render(
          <EntityTargetCard target={target} variant="compact" />
        );
        expect(screen.getByText(name)).toBeInTheDocument();
        // Compact cards have a specific padding
        const article = container.querySelector("[role='article']");
        expect(article).toHaveClass("p-3");
        unmount();
      });
    });
  });
});
