/**
 * TierRankBadge Component Tests
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierRankBadge } from "./tier-rank-badge.js";

describe("TierRankBadge", () => {
  describe("Ordinal rendering", () => {
    it('renders "1st" for rank 1', () => {
      render(<TierRankBadge rank={1} />);
      expect(screen.getByText("1st")).toBeInTheDocument();
    });

    it('renders "2nd" for rank 2', () => {
      render(<TierRankBadge rank={2} />);
      expect(screen.getByText("2nd")).toBeInTheDocument();
    });

    it('renders "3rd" for rank 3', () => {
      render(<TierRankBadge rank={3} />);
      expect(screen.getByText("3rd")).toBeInTheDocument();
    });

    it('renders "4th" for rank 4', () => {
      render(<TierRankBadge rank={4} />);
      expect(screen.getByText("4th")).toBeInTheDocument();
    });

    it('renders "10th" for rank 10', () => {
      render(<TierRankBadge rank={10} />);
      expect(screen.getByText("10th")).toBeInTheDocument();
    });

    it('renders "11th" for rank 11', () => {
      render(<TierRankBadge rank={11} />);
      expect(screen.getByText("11th")).toBeInTheDocument();
    });

    it('renders "12th" for rank 12', () => {
      render(<TierRankBadge rank={12} />);
      expect(screen.getByText("12th")).toBeInTheDocument();
    });

    it('renders "13th" for rank 13', () => {
      render(<TierRankBadge rank={13} />);
      expect(screen.getByText("13th")).toBeInTheDocument();
    });

    it('renders "21st" for rank 21', () => {
      render(<TierRankBadge rank={21} />);
      expect(screen.getByText("21st")).toBeInTheDocument();
    });

    it('renders "22nd" for rank 22', () => {
      render(<TierRankBadge rank={22} />);
      expect(screen.getByText("22nd")).toBeInTheDocument();
    });

    it('renders "23rd" for rank 23', () => {
      render(<TierRankBadge rank={23} />);
      expect(screen.getByText("23rd")).toBeInTheDocument();
    });
  });

  describe("Medal styling", () => {
    it("renders gold styling for rank 1", () => {
      render(<TierRankBadge rank={1} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("from-tier-gold-from", "to-tier-gold-to");
    });

    it("renders silver styling for rank 2", () => {
      render(<TierRankBadge rank={2} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("from-tier-silver-from", "to-tier-silver-to");
    });

    it("renders bronze styling for rank 3", () => {
      render(<TierRankBadge rank={3} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("from-tier-bronze-from", "to-tier-bronze-to");
    });

    it("renders neutral styling for rank 4+", () => {
      render(<TierRankBadge rank={4} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("from-tier-default-from", "to-tier-default-to");
    });

    it("renders neutral styling for rank 10", () => {
      render(<TierRankBadge rank={10} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("from-tier-default-from", "to-tier-default-to");
    });
  });

  describe("Medal icon", () => {
    it("renders medal icon for rank 1", () => {
      const { container } = render(<TierRankBadge rank={1} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders medal icon for rank 2", () => {
      const { container } = render(<TierRankBadge rank={2} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders medal icon for rank 3", () => {
      const { container } = render(<TierRankBadge rank={3} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("does not render medal icon for rank 4+", () => {
      const { container } = render(<TierRankBadge rank={4} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });

    it("does not render medal icon for rank 10", () => {
      const { container } = render(<TierRankBadge rank={10} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("applies small size styles", () => {
      render(<TierRankBadge rank={1} size="sm" />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("px-2", "py-0.5", "text-xs");
    });

    it("applies medium size styles by default", () => {
      render(<TierRankBadge rank={1} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("px-2.5", "py-1", "text-sm");
    });

    it("applies large size styles", () => {
      render(<TierRankBadge rank={1} size="lg" />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("px-3", "py-1.5", "text-base");
    });
  });

  describe("Accessibility", () => {
    it('has role="img"', () => {
      render(<TierRankBadge rank={1} />);
      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("has aria-label with rank ordinal", () => {
      render(<TierRankBadge rank={1} />);
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Ranked 1st");
    });

    it("includes tier name in aria-label when provided", () => {
      render(<TierRankBadge rank={1} tierName="Platinum" />);
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Platinum tier, ranked 1st");
    });

    it("includes tier name and ordinal for non-first ranks", () => {
      render(<TierRankBadge rank={3} tierName="Bronze" />);
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Bronze tier, ranked 3rd");
    });

    it("marks medal SVG as aria-hidden", () => {
      const { container } = render(<TierRankBadge rank={1} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Custom className", () => {
    it("applies additional className", () => {
      render(<TierRankBadge rank={1} className="custom-class" />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("custom-class");
    });

    it("preserves default classes when adding custom className", () => {
      render(<TierRankBadge rank={1} className="custom-class" />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass("inline-flex", "items-center", "rounded-full", "custom-class");
    });
  });
});
