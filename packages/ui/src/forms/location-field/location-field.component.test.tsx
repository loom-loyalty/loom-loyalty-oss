import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-location-field", () => ({
  useLocationField: () => ({
    options: [{ id: "loc_1", name: "Downtown", secondaryText: "DOWNTOWN" }],
    optionsAll: [{ id: "loc_1", name: "Downtown", secondaryText: "DOWNTOWN" }],
    isLoading: false,
    error: null,
    searchValue: "",
    setSearchValue: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
  }),
}));

import { LocationField } from "./location-field";

describe("LocationField create option", () => {
  it("has no Add New option without renderCreateSheet", () => {
    render(<LocationField value="" onValueChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Add New Location")).toBeNull();
  });

  it("opens the consumer's create sheet from the Add New option", () => {
    const renderCreateSheet = vi.fn((open: boolean) =>
      open ? <div data-testid="create-sheet" /> : null
    );
    render(
      <LocationField value="" onValueChange={() => {}} renderCreateSheet={renderCreateSheet} />
    );

    expect(screen.queryByTestId("create-sheet")).toBeNull();
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Add New Location"));

    expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
  });
});
