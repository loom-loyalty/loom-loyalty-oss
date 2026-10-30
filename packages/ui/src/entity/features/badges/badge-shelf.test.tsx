import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeShelf, type BadgeShelfItem } from "./badge-shelf.js";

const BADGES: BadgeShelfItem[] = [
  { id: "b1", name: "Ready to Start", status: "earned", detail: "Earned week 1" },
  {
    id: "b2",
    name: "Nutrition Pro",
    status: "in_progress",
    detail: "2 of 5 lessons",
    progress: { current: 2, target: 5 },
  },
  { id: "b3", name: "Moving More", status: "locked" },
];

describe("BadgeShelf", () => {
  it("counts earned badges in the header", () => {
    render(<BadgeShelf badges={BADGES} />);
    expect(screen.getByRole("heading", { name: "Badges" })).toBeInTheDocument();
    expect(screen.getByText("1 earned")).toBeInTheDocument();
  });

  it("puts each badge's status in its text, not only in color or icon", () => {
    render(<BadgeShelf badges={BADGES} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Ready to Start, Earned");
    expect(items[0]).toHaveTextContent("Earned week 1");
    expect(items[1]).toHaveTextContent("Nutrition Pro, In progress");
    expect(items[2]).toHaveTextContent("Moving More, Locked");
  });

  it("shows progress only for in-progress badges, announced as a count", () => {
    render(<BadgeShelf badges={BADGES} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAccessibleName("Nutrition Pro progress");
    expect(bars[0]).toHaveAttribute("aria-valuenow", "2");
    expect(bars[0]).toHaveAttribute("aria-valuemax", "5");
    expect(bars[0]).toHaveAttribute("aria-valuetext", "2 of 5");
  });

  it("draws no bar for an earned badge with progress, or a zero target", () => {
    render(
      <BadgeShelf
        badges={[
          { id: "e", name: "Done", status: "earned", progress: { current: 5, target: 5 } },
          { id: "z", name: "Empty", status: "in_progress", progress: { current: 0, target: 0 } },
          { id: "n", name: "No progress", status: "in_progress" },
        ]}
      />
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders an empty shelf with a zero count", () => {
    render(<BadgeShelf badges={[]} />);
    expect(screen.getByText("0 earned")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("uses a custom title for the heading and the section name", () => {
    render(<BadgeShelf badges={BADGES} title="My badges" />);
    expect(screen.getByRole("region", { name: "My badges" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My badges" })).toBeInTheDocument();
  });
});
