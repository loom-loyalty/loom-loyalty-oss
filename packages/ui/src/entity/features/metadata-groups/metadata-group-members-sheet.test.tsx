/**
 * MetadataGroupMembersSheet — editing an existing group's membership (R9).
 *
 * This sheet is the only surface where an operator changes a saved group
 * without rebuilding it, so the gaps it closes are all "the control is there
 * but does nothing":
 *  - the search box has to actually narrow the rendered members;
 *  - a group larger than one page has to expose page controls rather than
 *    stopping silently at the first page;
 *  - a failed membership write has to say so inline while leaving the
 *    membership that is already rendered untouched;
 *  - a member id that arrives twice must render once, so re-adding an
 *    existing member can never read as a duplicate row.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  MetadataGroupMembersSheet,
  type MetadataGroupMember,
  type MetadataGroupMembersSheetProps,
} from "./metadata-group-members-sheet.js";

function member(overrides: Partial<MetadataGroupMember> = {}): MetadataGroupMember {
  return {
    id: "m1",
    code: "AUSTIN",
    name: "Austin",
    typeCode: "LOCATION",
    ...overrides,
  };
}

const BASE_PROPS: MetadataGroupMembersSheetProps = {
  open: true,
  onOpenChange: vi.fn(),
  groupName: "Texas stores",
  members: [],
  search: "",
  onSearchChange: vi.fn(),
  onRemoveMember: vi.fn(),
  onAddClick: vi.fn(),
};

/** Controlled harness so typing in the search box actually moves `search`. */
function Harness(props: Partial<MetadataGroupMembersSheetProps>): ReactNode {
  const [search, setSearch] = useState("");
  return (
    <MetadataGroupMembersSheet
      {...BASE_PROPS}
      {...props}
      search={search}
      onSearchChange={setSearch}
    />
  );
}

/** Member names rendered in the table body, in order. */
function renderedMemberNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1) // drop the header row
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? "");
}

describe("MetadataGroupMembersSheet — finding a member", () => {
  it("narrows the rendered members to those matching the search text", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m2", code: "DALLAS", name: "Dallas" }),
          member({ id: "m3", code: "HOUSTON", name: "Houston" }),
        ]}
      />
    );

    expect(renderedMemberNames()).toHaveLength(3);

    await user.type(screen.getByRole("searchbox"), "dall");

    const names = renderedMemberNames();
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Dallas");
  });

  it("matches on code as well as name, case-insensitively", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        members={[
          member({ id: "m1", code: "TX-AUSTIN-01", name: "Congress Ave" }),
          member({ id: "m2", code: "OK-TULSA-01", name: "Main St" }),
        ]}
      />
    );

    await user.type(screen.getByRole("searchbox"), "tx-austin");

    const names = renderedMemberNames();
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Congress Ave");
  });

  it("tells the operator when a search only covers the page it can see", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        members={[member({ id: "m1", code: "AUSTIN", name: "Austin" })]}
        pagination={{ page: 1, pageSize: 100, total: 250, onPageChange: vi.fn() }}
      />
    );

    await user.type(screen.getByRole("searchbox"), "aus");

    expect(screen.getByText(/only the members on this page/i)).toBeInTheDocument();
  });

  it("does not caveat the search when the whole group fits on one page", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        members={[member({ id: "m1", code: "AUSTIN", name: "Austin" })]}
        pagination={{ page: 1, pageSize: 100, total: 1, onPageChange: vi.fn() }}
      />
    );

    await user.type(screen.getByRole("searchbox"), "aus");

    expect(screen.queryByText(/only the members on this page/i)).not.toBeInTheDocument();
  });
});

describe("MetadataGroupMembersSheet — a group larger than one page", () => {
  it("exposes page controls driven by the group total, not the loaded page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Harness
        members={[member()]}
        total={250}
        pagination={{ page: 1, pageSize: 100, total: 250, onPageChange }}
      />
    );

    const pagination = screen.getByRole("navigation", { name: /pagination/i });
    await user.click(within(pagination).getByRole("button", { name: "Next page" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("reports the group total rather than the number of rows on screen", () => {
    render(
      <Harness
        members={[member({ id: "m1" }), member({ id: "m2", code: "DALLAS", name: "Dallas" })]}
        total={250}
        pagination={{ page: 1, pageSize: 100, total: 250, onPageChange: vi.fn() }}
      />
    );

    expect(screen.getByText(/250 members in this group/i)).toBeInTheDocument();
  });
});

describe("MetadataGroupMembersSheet — a membership write that fails", () => {
  it("surfaces the error inline and leaves the rendered membership intact", () => {
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m2", code: "DALLAS", name: "Dallas" }),
        ]}
        error="Failed to remove metadata from group"
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/failed to remove metadata from group/i);
    expect(renderedMemberNames()).toHaveLength(2);
  });

  it("renders no alert when there is no error", () => {
    render(<Harness members={[member()]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MetadataGroupMembersSheet — a member that arrives twice", () => {
  it("renders one row per member id", () => {
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m2", code: "DALLAS", name: "Dallas" }),
        ]}
      />
    );

    expect(renderedMemberNames()).toHaveLength(2);
  });

  it("counts the duplicate once in the member total the operator reads", () => {
    // The server total counts rows, so a group of two whose membership came back
    // with one id twice reports three. The operator would read a member that is
    // not there.
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m2", code: "DALLAS", name: "Dallas" }),
        ]}
        total={3}
        pagination={{ page: 1, pageSize: 100, total: 3, onPageChange: vi.fn() }}
      />
    );

    expect(screen.getByText(/2 members in this group/i)).toBeInTheDocument();
    expect(screen.queryByText(/3 members in this group/i)).not.toBeInTheDocument();
  });

  it("does not caveat the search when only a duplicate makes the total look larger", async () => {
    // Every member of this group is on this page; the raw total is only bigger
    // because one of them arrived twice. Telling the operator to change pages
    // sends them to a page that holds nothing.
    const user = userEvent.setup();
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m2", code: "DALLAS", name: "Dallas" }),
        ]}
        total={3}
        pagination={{ page: 1, pageSize: 100, total: 3, onPageChange: vi.fn() }}
      />
    );

    await user.type(screen.getByRole("searchbox"), "aus");

    expect(screen.queryByText(/only the members on this page/i)).not.toBeInTheDocument();
  });

  it("still caveats the search when a later page really does hold members", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        members={[
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
          member({ id: "m1", code: "AUSTIN", name: "Austin" }),
        ]}
        total={250}
        pagination={{ page: 1, pageSize: 100, total: 250, onPageChange: vi.fn() }}
      />
    );

    await user.type(screen.getByRole("searchbox"), "aus");

    expect(screen.getByText(/only the members on this page/i)).toBeInTheDocument();
    expect(screen.getByText(/249 members in this group/i)).toBeInTheDocument();
  });
});

describe("MetadataGroupMembersSheet — removing a member", () => {
  it("hands the member id to the caller", async () => {
    const user = userEvent.setup();
    const onRemoveMember = vi.fn();
    render(
      <Harness
        members={[member({ id: "m1", code: "AUSTIN", name: "Austin" })]}
        onRemoveMember={onRemoveMember}
      />
    );

    await user.click(screen.getByRole("button", { name: /remove austin from group/i }));

    expect(onRemoveMember).toHaveBeenCalledWith("m1");
  });

  it("offers no remove control when the operator cannot edit", () => {
    render(<Harness members={[member()]} canEdit={false} />);

    expect(screen.queryByRole("button", { name: /remove .* from group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add metadata/i })).not.toBeInTheDocument();
  });
});
