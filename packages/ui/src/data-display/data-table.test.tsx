import { axe } from "@loom-loyalty/test-utils/axe";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  DataTable,
  type BulkAction,
  type Column,
  type DataTableAction,
  type DataTableProps,
  type SortState,
} from "./data-table";

interface Row {
  id: string;
  name: string;
  email: string;
  count: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Alpha", email: "a@example.com", count: 1 },
  { id: "2", name: "Beta", email: "b@example.com", count: 2 },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "email", header: "Email", render: (r) => r.email },
  { key: "count", header: "Count", render: (r) => r.count },
];

const SORTABLE = ["name", "count"] as const;

describe("DataTable sort UI", () => {
  it("renders a sort button + arrow on sortable columns", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        onSortChange={vi.fn()}
      />
    );
    // Sortable headers render a <button> (accessible name == column header text).
    expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count" })).toBeInTheDocument();
  });

  it("non-sortable columns render as plain <th> with no button", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        onSortChange={vi.fn()}
      />
    );
    // Email is not in SORTABLE — should not render a sort button.
    expect(screen.queryByRole("button", { name: "Email" })).not.toBeInTheDocument();
    // The Email <th> should still exist as a column header.
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
  });

  it("toggles aria-sort on the active column", () => {
    const sort: SortState = { column: "name", direction: "asc" };
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        sort={sort}
        onSortChange={vi.fn()}
      />
    );

    // Active column shows ascending; other sortable column shows none; non-sortable has no aria-sort.
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
    expect(screen.getByRole("columnheader", { name: /Count/ })).toHaveAttribute(
      "aria-sort",
      "none"
    );
    expect(screen.getByRole("columnheader", { name: "Email" })).not.toHaveAttribute("aria-sort");

    rerender(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        sort={{ column: "name", direction: "desc" }}
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  it("cycles asc → desc → null on repeated clicks of the same column", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    // Start unsorted → click → asc.
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "asc" });

    // asc → desc.
    rerender(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        sort={{ column: "name", direction: "asc" }}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "desc" });

    // desc → null (clear).
    rerender(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        sort={{ column: "name", direction: "desc" }}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
  });

  it("switching column starts a fresh asc, not desc", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        sort={{ column: "name", direction: "desc" }}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Count" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "count", direction: "asc" });
  });

  it("fires onSortChange when the header button is keyboard-activated", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        onSortChange={onSortChange}
      />
    );
    const button = screen.getByRole("button", { name: "Name" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "asc" });

    onSortChange.mockClear();
    await user.keyboard(" ");
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "asc" });
  });

  it("uses column.sortKey when the display key differs from the sort field", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const columns: Column<Row>[] = [
      { key: "display-name", sortKey: "name", header: "Name", render: (r) => r.name },
    ];
    render(
      <DataTable
        columns={columns}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={["name"]}
        sort={{ column: "name", direction: "asc" }}
        onSortChange={onSortChange}
      />
    );
    // aria-sort tracks the sortKey, not the column key.
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "desc" });
  });

  it("renders headers without sort buttons when onSortChange is omitted", () => {
    render(
      <DataTable columns={COLUMNS} data={ROWS} getRowKey={(r) => r.id} sortableColumns={SORTABLE} />
    );
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  });

  it("sort header button meets the 44px minimum touch target", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        sortableColumns={SORTABLE}
        onSortChange={vi.fn()}
      />
    );
    // Root CLAUDE.md: touch targets must be >= 44x44. We assert the class
    // rather than computed layout to avoid JSDOM layout limitations.
    expect(screen.getByRole("button", { name: "Name" })).toHaveClass("min-h-[44px]");
  });
});

describe("DataTableAction type contract", () => {
  // Lock the return type as exactly `void | Promise<void>`. expectTypeOf fails at
  // compile time if the return narrows back to `void`, so a future revert can't
  // sneak past — TS's return-position bivariance would silently accept both shapes
  // for a runtime `typeof === 'function'` assertion.
  it("DataTableAction.onClick returns void | Promise<void>", () => {
    expectTypeOf<DataTableAction["onClick"]>().returns.toEqualTypeOf<void | Promise<void>>();
  });

  it("async onClick is assignable; sync onClick is assignable", () => {
    expectTypeOf<(item: unknown) => Promise<void>>().toMatchTypeOf<DataTableAction["onClick"]>();
    expectTypeOf<(item: unknown) => void>().toMatchTypeOf<DataTableAction["onClick"]>();
  });
});

describe("DataTable row actions", () => {
  it("shows a row's menu with only the actions it doesn't hide", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        actions={[
          { label: "Edit", onClick: vi.fn() },
          { label: "Archive", onClick: vi.fn(), hidden: (r) => (r as Row).id === "1" },
        ]}
      />
    );

    await user.click(screen.getAllByRole("button", { name: /open menu/i })[0] as HTMLElement);

    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("leaves out the menu on a row whose actions are all hidden", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        actions={[{ label: "Edit", onClick: vi.fn(), hidden: (r) => (r as Row).id === "1" }]}
      />
    );

    expect(screen.getAllByRole("button", { name: /open menu/i })).toHaveLength(1);
  });
});

describe("DataTable pagination a11y", () => {
  function renderPaginated(page = 1, total = 75, pageSize = 25) {
    return render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        pagination={{ page, pageSize, total, onPageChange: vi.fn() }}
      />
    );
  }

  it("wraps the pagination block in a named navigation landmark", () => {
    renderPaginated();
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
  });

  it("labels the prev/next chevron buttons", () => {
    renderPaginated(2);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("labels each numeric page button and marks the active page with aria-current", () => {
    renderPaginated(2);
    const page1 = screen.getByRole("button", { name: "Page 1" });
    const page2 = screen.getByRole("button", { name: "Page 2" });
    const page3 = screen.getByRole("button", { name: "Page 3" });
    expect(page1).not.toHaveAttribute("aria-current");
    expect(page2).toHaveAttribute("aria-current", "page");
    expect(page3).not.toHaveAttribute("aria-current");
  });
});

describe("DataTable rows-per-page selector", () => {
  function renderWithSize(total: number, onPageSizeChange = vi.fn(), pageSize = 25) {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        pagination={{ page: 1, pageSize, total, onPageChange: vi.fn(), onPageSizeChange }}
      />
    );
    return onPageSizeChange;
  }

  it("offers 10, 25, 50 and 100 rows and reports the choice", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = renderWithSize(75);

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(screen.getByRole("option", { name: "50" }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("stays visible on a single page while a smaller size would split it", () => {
    renderWithSize(20);
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("hides the footer when every size fits on one page", () => {
    renderWithSize(5);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("is absent when the caller does not handle size changes", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        pagination={{ page: 1, pageSize: 25, total: 75, onPageChange: vi.fn() }}
      />
    );
    expect(screen.queryByRole("combobox", { name: "Rows per page" })).not.toBeInTheDocument();
  });
});

describe("DataTable floor totals", () => {
  it("reads N+ and offers one page past the rows known so far", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        pagination={{
          page: 2,
          pageSize: 25,
          total: 50,
          totalIsLowerBound: true,
          onPageChange: vi.fn(),
        }}
      />
    );
    expect(screen.getByText(/Showing 26 to 50 of 50\+ results/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });
});

describe("DataTable clickable rows (keyboard a11y)", () => {
  function renderClickable(onRowClick: (r: Row) => void) {
    return render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
        getRowLabel={(r) => `Open ${r.name}`}
      />
    );
  }

  it("activates a row on click", () => {
    const onRowClick = vi.fn();
    renderClickable(onRowClick);

    fireEvent.click(screen.getByText("Alpha"));

    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("makes clickable rows focusable and operable via Enter and Space", () => {
    const onRowClick = vi.fn();
    renderClickable(onRowClick);

    const row = screen.getByText("Beta").closest("tr") as HTMLElement;
    expect(row).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);
  });

  it("leaves rows non-focusable when not clickable", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} getRowKey={(r) => r.id} />);

    const row = screen.getByText("Alpha").closest("tr") as HTMLElement;
    expect(row).not.toHaveAttribute("tabindex");
  });

  it("names a clickable row via getRowLabel (WCAG 4.1.2)", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowKey={(r) => r.id}
        onRowClick={vi.fn()}
        getRowLabel={(r) => `Open ${r.name}`}
      />
    );

    expect(screen.getByRole("row", { name: "Open Alpha" })).toBeInTheDocument();
  });

  it("does not fire onRowClick when Enter bubbles from a nested control", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
        getRowLabel={(r) => `Open ${r.name}`}
        actions={[{ label: "Edit", onClick: vi.fn() }]}
      />
    );

    // Keydown on the nested actions trigger must not bubble into a row activation.
    const menuTrigger = screen.getAllByRole("button", { name: /open menu/i })[0] as HTMLElement;
    fireEvent.keyDown(menuTrigger, { key: "Enter" });
    expect(onRowClick).not.toHaveBeenCalled();

    // The row itself still activates.
    const row = screen.getByText("Alpha").closest("tr") as HTMLElement;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe("DataTable cross-page selection", () => {
  // PAGE_2 stands in for a second API page: the rows selected on page 1
  // (ids "1" and "2") are no longer in `data`, so anything the table derives
  // from `data` alone cannot see them.
  const PAGE_2: Row[] = [
    { id: "3", name: "Gamma", email: "g@example.com", count: 3 },
    { id: "4", name: "Delta", email: "d@example.com", count: 4 },
  ];

  // Only the selection props vary — spreading a Partial<DataTableProps> would
  // collapse the onRowClick/getRowLabel pairing the props union enforces.
  interface SelectionProps {
    selectedKeys?: DataTableProps<Row>["selectedKeys"];
    onSelectionChange?: DataTableProps<Row>["onSelectionChange"];
    bulkActions?: DataTableProps<Row>["bulkActions"];
  }

  function renderSelectable(props: SelectionProps = {}) {
    return render(
      <DataTable
        columns={COLUMNS}
        data={PAGE_2}
        getRowKey={(r) => r.id}
        enableRowSelection
        {...props}
      />
    );
  }

  it("hands onSelectionChange the full cross-page key set, not just this page's keys", () => {
    const onSelectionChange = vi.fn();
    renderSelectable({ selectedKeys: new Set(["1", "2"]), onSelectionChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    // Items stay page-scoped (the table only holds this page), but the key set
    // must carry the page-1 selection through so the consumer can stop
    // rebuilding its authoritative keys from the page array.
    expect(onSelectionChange).toHaveBeenCalledWith([PAGE_2[0]], new Set(["1", "2", "3"]));
  });

  it("leaves off-page keys untouched when a row on this page is deselected", () => {
    const onSelectionChange = vi.fn();
    renderSelectable({ selectedKeys: new Set(["1", "2", "3"]), onSelectionChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(onSelectionChange).toHaveBeenCalledWith([], new Set(["1", "2"]));
  });

  it("selects the whole page on top of an existing off-page selection", () => {
    const onSelectionChange = vi.fn();
    renderSelectable({ selectedKeys: new Set(["1"]), onSelectionChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));

    expect(onSelectionChange).toHaveBeenCalledWith(PAGE_2, new Set(["1", "3", "4"]));
  });

  // The round trip, not just the call shape: BulkAction.onClick already took
  // (items, keys), so handing it a hand-written key set proves nothing. Here
  // the consumer stores what onSelectionChange emits and feeds it straight
  // back — the loop this change exists to enable. Before it, the emitted key
  // set was undefined, the controlled selection collapsed, and the toolbar
  // this clicks was gone.
  it("gives a bulk action this page's items and the key set it fed back", () => {
    const onClick = vi.fn();

    function ControlledTable() {
      const [keys, setKeys] = useState(new Set(["1", "2"]));
      return (
        <DataTable
          columns={COLUMNS}
          data={PAGE_2}
          getRowKey={(r) => r.id}
          enableRowSelection
          selectedKeys={keys}
          onSelectionChange={(_items, allSelectedKeys) => setKeys(allSelectedKeys)}
          bulkActions={[{ label: "Enable", onClick }] satisfies BulkAction<Row>[]}
        />
      );
    }

    render(<ControlledTable />);

    // Row "3" is on this page; "1" and "2" are the off-page selection the
    // consumer is holding on the table's behalf.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));

    expect(onClick).toHaveBeenCalledWith([PAGE_2[0]], new Set(["1", "2", "3"]));
  });

  it("clears the selection across every page, not just this one", () => {
    const onSelectionChange = vi.fn();
    const bulkActions: BulkAction<Row>[] = [{ label: "Enable", onClick: vi.fn() }];
    renderSelectable({ selectedKeys: new Set(["1", "2", "3"]), bulkActions, onSelectionChange });

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onSelectionChange).toHaveBeenCalledWith([], new Set());
  });

  it("keeps uncontrolled selection behaving as before", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowKey={(r) => r.id}
        enableRowSelection
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith([ROWS[0]], new Set(["1"]));

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(ROWS, new Set(["1", "2"]));
  });

  it("still selects a range on Shift+Click within the page", () => {
    const onSelectionChange = vi.fn();
    const rows = [...ROWS, ...PAGE_2];
    render(
      <DataTable
        columns={COLUMNS}
        data={rows}
        getRowKey={(r) => r.id}
        enableRowSelection
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 4" }), { shiftKey: true });

    expect(onSelectionChange).toHaveBeenLastCalledWith(rows, new Set(["1", "2", "3", "4"]));
  });
});

describe("DataTable per-row selectability", () => {
  // Rows 2 and 4 cannot be selected; rows 1 and 3 can.
  const MIXED: Row[] = [
    { id: "1", name: "Alpha", email: "a@example.com", count: 1 },
    { id: "2", name: "Beta", email: "b@example.com", count: 2 },
    { id: "3", name: "Gamma", email: "g@example.com", count: 3 },
    { id: "4", name: "Delta", email: "d@example.com", count: 4 },
  ];
  const evenLocked = (row: Row) =>
    row.count % 2 === 0
      ? { selectable: false, reason: `${row.name} is locked` }
      : { selectable: true };

  interface SelectabilityProps {
    data?: Row[];
    selectedKeys?: DataTableProps<Row>["selectedKeys"];
    onSelectionChange?: DataTableProps<Row>["onSelectionChange"];
    getRowSelectability?: DataTableProps<Row>["getRowSelectability"];
  }

  function renderMixed({ data = MIXED, ...props }: SelectabilityProps = {}) {
    return render(
      <DataTable
        columns={COLUMNS}
        data={data}
        getRowKey={(r) => r.id}
        enableRowSelection
        getRowSelectability={evenLocked}
        {...props}
      />
    );
  }

  it("disables an unselectable row's checkbox and describes it with the reason", () => {
    renderMixed();

    const locked = screen.getByRole("checkbox", { name: "Select row 2" });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAccessibleDescription("Beta is locked");

    const open = screen.getByRole("checkbox", { name: "Select row 1" });
    expect(open).toBeEnabled();
    expect(open).not.toHaveAccessibleDescription();
  });

  it("ignores a click on an unselectable row, and does not activate the row", async () => {
    const onSelectionChange = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={MIXED}
        getRowKey={(r) => r.id}
        enableRowSelection
        getRowSelectability={evenLocked}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        getRowLabel={(r) => `Open ${r.name}`}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Select row 2" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("header select-all selects only the selectable rows", () => {
    const onSelectionChange = vi.fn();
    renderMixed({ selectedKeys: new Set(), onSelectionChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));

    expect(onSelectionChange).toHaveBeenCalledWith([MIXED[0], MIXED[2]], new Set(["1", "3"]));
  });

  it("header is checked once every selectable row is selected, and toggling deselects them", () => {
    const onSelectionChange = vi.fn();
    // "9" is an off-page key that must survive the page deselect.
    renderMixed({ selectedKeys: new Set(["1", "3", "9"]), onSelectionChange });

    const header = screen.getByRole("checkbox", { name: "Deselect all on this page" });
    expect(header).toHaveAttribute("aria-checked", "true");

    fireEvent.click(header);

    expect(onSelectionChange).toHaveBeenCalledWith([], new Set(["9"]));
  });

  it("header is indeterminate when only some selectable rows are selected", () => {
    renderMixed({ selectedKeys: new Set(["1"]), onSelectionChange: vi.fn() });

    expect(screen.getByRole("checkbox", { name: "Select all on this page" })).toHaveAttribute(
      "aria-checked",
      "mixed"
    );
  });

  it("disables the header when no row on the page can be selected", () => {
    const onSelectionChange = vi.fn();
    renderMixed({ data: [MIXED[1]!, MIXED[3]!], onSelectionChange });

    const header = screen.getByRole("checkbox", { name: "Select all on this page" });
    expect(header).toBeDisabled();
    expect(header).toHaveAttribute("aria-checked", "false");
  });

  it("skips unselectable rows in a Shift+Click range", () => {
    const onSelectionChange = vi.fn();
    renderMixed({ onSelectionChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }), { shiftKey: true });

    expect(onSelectionChange).toHaveBeenLastCalledWith([MIXED[0], MIXED[2]], new Set(["1", "3"]));
  });

  it("passes the row index to getRowSelectability", () => {
    const getRowSelectability = vi.fn((_row: Row, index: number) => ({
      selectable: index !== 0,
      reason: index === 0 ? "First row is fixed" : undefined,
    }));
    renderMixed({ getRowSelectability });

    expect(getRowSelectability).toHaveBeenCalledWith(MIXED[0], 0);
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Select row 2" })).toBeEnabled();
  });

  it("keeps every checkbox enabled and the header unchanged without the prop", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={MIXED}
        getRowKey={(r) => r.id}
        enableRowSelection
        onSelectionChange={onSelectionChange}
      />
    );

    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByRole("checkbox", { name: `Select row ${n}` })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    expect(onSelectionChange).toHaveBeenCalledWith(MIXED, new Set(["1", "2", "3", "4"]));
  });

  it("passes axe with disabled, described checkboxes", async () => {
    const { container } = renderMixed({ selectedKeys: new Set(["1"]), onSelectionChange: vi.fn() });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DataTable selection callback type contract", () => {
  // Compile-time only (expectTypeOf is erased at runtime) — `pnpm type-check`
  // is the gate. The first assertion is the additive guarantee: the 44 existing
  // call sites pass a one-argument callback and must keep compiling.
  it("a consumer that ignores the key-set argument is still assignable", () => {
    expectTypeOf<(items: Row[]) => void>().toMatchTypeOf<
      NonNullable<DataTableProps<Row>["onSelectionChange"]>
    >();
  });

  it("onSelectionChange carries the full selected key set as its second argument", () => {
    expectTypeOf<NonNullable<DataTableProps<Row>["onSelectionChange"]>>().parameters.toEqualTypeOf<
      [Row[], Set<string>]
    >();
  });
});

describe("DataTable virtualized mode", () => {
  const ROW_HEIGHT = 40;
  const VIEWPORT_HEIGHT = 400;
  const OVERSCAN = 5;

  const bigRows = (n: number, prefix = "Row"): Row[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      name: `${prefix} ${i}`,
      email: `r${i}@example.com`,
      count: i,
    }));

  let offsetHeightDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    // jsdom runs no layout, so every element reports offsetHeight 0 — and a
    // virtualizer whose scroll container measures 0 renders nothing at all.
    // Report the inline height or max-height a real browser would honour instead.
    offsetHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseInt(this.style.height || this.style.maxHeight, 10) || 0;
      },
    });
  });

  afterAll(() => {
    if (offsetHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeightDescriptor);
    }
  });

  function scrollContainer(): HTMLElement {
    const table = screen.getByRole("table");
    const container = table.parentElement;
    if (!container) throw new Error("table has no scroll container");
    return container;
  }

  /** jsdom never scrolls on its own; drive the offset the way a browser would. */
  function scrollTableTo(top: number) {
    const container = scrollContainer();
    container.scrollTop = top;
    fireEvent.scroll(container);
  }

  interface VirtualCase {
    data?: Row[];
    totalCount?: number;
    virtualization?: Partial<
      Extract<NonNullable<DataTableProps<Row>["virtualization"]>, { maxHeight: number }>
    >;
    enableRowSelection?: boolean;
    selectedKeys?: Set<string>;
    onSelectionChange?: DataTableProps<Row>["onSelectionChange"];
    actions?: DataTableAction[];
  }

  function virtualTable({
    data = bigRows(10_000),
    totalCount = 12_000,
    ...rest
  }: VirtualCase = {}) {
    const { virtualization, ...props } = rest;
    return (
      <DataTable
        columns={COLUMNS}
        data={data}
        getRowKey={(r) => r.id}
        totalCount={totalCount}
        virtualization={{
          maxHeight: VIEWPORT_HEIGHT,
          rowHeight: ROW_HEIGHT,
          overscan: OVERSCAN,
          ...virtualization,
        }}
        {...props}
      />
    );
  }

  function renderVirtual(props: VirtualCase = {}) {
    return render(virtualTable(props));
  }

  it("caps the virtualized viewport with max-height instead of a fixed height", () => {
    renderVirtual();

    const container = scrollContainer();
    expect(container).toHaveStyle({ maxHeight: `${VIEWPORT_HEIGHT}px` });
    expect(container.style.height).toBe("");
  });

  it("supports the deprecated height alias as the viewport maximum", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={bigRows(10_000)}
        getRowKey={(row) => row.id}
        totalCount={12_000}
        virtualization={{ height: VIEWPORT_HEIGHT, rowHeight: ROW_HEIGHT, overscan: OVERSCAN }}
      />
    );

    const container = scrollContainer();
    expect(container).toHaveStyle({ maxHeight: `${VIEWPORT_HEIGHT}px` });
    expect(container.style.height).toBe("");
  });

  it("renders every short-list row and the empty state inside the viewport", () => {
    const { unmount } = renderVirtual({ data: bigRows(3), totalCount: 3 });

    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Row 2")).toBeInTheDocument();

    unmount();
    renderVirtual({ data: [], totalCount: 0 });

    const container = scrollContainer();
    expect(container).toContainElement(screen.getByText("No data available"));
  });

  /** The data index the row's own content reports, independent of its DOM position. */
  function dataIndexOf(row: HTMLElement): number {
    const label = within(row).getByText(/^\w+ \d+$/).textContent ?? "";
    return Number(label.replace(/^\D+/, ""));
  }

  it("renders a bounded number of row elements from a 10,000-row array", () => {
    renderVirtual();

    const rows = screen.getAllByRole("row");
    // Header + a viewport's worth (10) + overscan on both sides — nowhere near 10,000.
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.length).toBeLessThanOrEqual(40);
    expect(screen.queryByText("Row 9999")).not.toBeInTheDocument();
  });

  it("reports the server total in aria-rowcount, not the rendered count", () => {
    renderVirtual({ data: bigRows(10_000), totalCount: 12_000 });

    // +1 for the header row: aria-rowindex is 1-based across the whole table,
    // so the count has to include the header or the last row indexes past it.
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "12001");
    expect(screen.getAllByRole("row")[0]).toHaveAttribute("aria-rowindex", "1");
  });

  it("gives the first rendered row its absolute aria-rowindex after scrolling", () => {
    renderVirtual();

    scrollTableTo(100 * ROW_HEIGHT);

    const firstBodyRow = screen.getAllByRole("row")[1] as HTMLElement;
    const dataIndex = dataIndexOf(firstBodyRow);
    expect(dataIndex).toBeGreaterThan(50);
    expect(firstBodyRow).toHaveAttribute("aria-rowindex", String(dataIndex + 2));
  });

  it("keeps a focused row mounted and focused once it scrolls out of the window", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={bigRows(10_000)}
        getRowKey={(r) => r.id}
        totalCount={10_000}
        virtualization={{ maxHeight: VIEWPORT_HEIGHT, rowHeight: ROW_HEIGHT, overscan: OVERSCAN }}
        onRowClick={vi.fn()}
        getRowLabel={(r) => `Open ${r.name}`}
      />
    );

    const row = screen.getByRole("row", { name: "Open Row 0" });
    // A raw .focus() runs the row's focus handler outside React's batching.
    act(() => row.focus());
    expect(row).toHaveFocus();

    scrollTableTo(200 * ROW_HEIGHT);

    expect(screen.getByRole("row", { name: "Open Row 0" })).toBeInTheDocument();
    expect(row).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("resets scroll position and stale measurements when the row array changes", () => {
    const { rerender } = render(virtualTable({ data: bigRows(10_000) }));

    scrollTableTo(500 * ROW_HEIGHT);
    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();

    rerender(virtualTable({ data: bigRows(50, "Fresh"), totalCount: 50 }));

    expect(scrollContainer().scrollTop).toBe(0);
    // A browser emits a scroll event after a programmatic scrollTop write; jsdom does not.
    fireEvent.scroll(scrollContainer());

    expect(screen.getByText("Fresh 0")).toBeInTheDocument();
    expect(screen.queryByText(/^Row \d+$/)).not.toBeInTheDocument();
  });

  it("keeps authoritative column widths across two scroll offsets", () => {
    renderVirtual();
    const table = screen.getByRole("table");

    // table-layout: fixed + a colgroup is the entire width authority in this
    // mode, so identical markup is identical geometry. jsdom runs no layout,
    // which is why this asserts the authority rather than measured widths.
    expect(table).toHaveClass("table-fixed");
    const before = table.querySelector("colgroup")?.outerHTML;
    expect(before).toBeTruthy();

    scrollTableTo(150 * ROW_HEIGHT);

    expect(table.querySelector("colgroup")?.outerHTML).toBe(before);
    expect(table).toHaveClass("table-fixed");
  });

  it("clamps a windowed row to the fixed row height instead of growing it", () => {
    renderVirtual();

    const bodyRow = screen.getAllByRole("row")[1] as HTMLElement;
    expect(bodyRow).toHaveStyle({ height: `${ROW_HEIGHT}px` });
    expect(bodyRow.querySelector("td")).toHaveClass("overflow-hidden");
  });

  it("activates a windowed row, which is how the detail sheet gets the full value", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={bigRows(10_000)}
        getRowKey={(r) => r.id}
        totalCount={10_000}
        virtualization={{ maxHeight: VIEWPORT_HEIGHT, rowHeight: ROW_HEIGHT, overscan: OVERSCAN }}
        onRowClick={onRowClick}
        getRowLabel={(r) => `Open ${r.name}`}
      />
    );

    scrollTableTo(100 * ROW_HEIGHT);
    const bodyRow = screen.getAllByRole("row")[1] as HTMLElement;
    const index = dataIndexOf(bodyRow);
    fireEvent.click(bodyRow);

    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: `Row ${index}` }));
  });

  it("opens a row action menu from a windowed row, outside the scroll container", async () => {
    const user = userEvent.setup();
    renderVirtual({ actions: [{ label: "Edit", onClick: vi.fn() }] });

    scrollTableTo(100 * ROW_HEIGHT);
    // Captured first: an open Radix menu aria-hides the rest of the document,
    // so the table is no longer reachable by role while the menu is up.
    const container = scrollContainer();
    await user.click(screen.getAllByRole("button", { name: /open menu/i })[0] as HTMLElement);

    const item = await screen.findByRole("menuitem", { name: "Edit" });
    // Radix portals the menu out of the scroll container, so it cannot be clipped by it.
    expect(container.contains(item)).toBe(false);
  });

  it("lets a keyboard-only operator fetch the page past the rows already loaded", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderVirtual({
      data: bigRows(100),
      totalCount: 250,
      virtualization: { hasMore: true, onLoadMore },
    });

    const button = screen.getByRole("button", { name: /load more/i });
    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("omits the load-more control when there is nothing left to fetch", () => {
    renderVirtual({ data: bigRows(100), totalCount: 100, virtualization: { hasMore: false } });

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("keeps the header visible while the body scrolls", () => {
    renderVirtual();

    expect(document.querySelector("thead")).toHaveClass("sticky", "top-0");
  });

  it("announces the loaded count and the windowing through a status region", () => {
    renderVirtual({ data: bigRows(100), totalCount: 12_000 });

    expect(screen.getByRole("status")).toHaveTextContent("Showing 100 of 12,000 entries");
  });

  it("keys a windowed row by its own item, not by its position in the window", () => {
    const onSelectionChange = vi.fn();
    const data = bigRows(10_000);
    renderVirtual({
      data,
      enableRowSelection: true,
      selectedKeys: new Set(["Row-150"]),
      onSelectionChange,
    });

    scrollTableTo(150 * ROW_HEIGHT);

    // Labels and selection state both key off the absolute row index.
    expect(screen.getByRole("checkbox", { name: "Select row 151" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 152" }));

    expect(onSelectionChange).toHaveBeenCalledWith(
      [data[150], data[151]],
      new Set(["Row-150", "Row-151"])
    );
  });

  it("passes axe on the windowed table, selection and row actions included", async () => {
    const { container } = renderVirtual({
      data: bigRows(10_000),
      enableRowSelection: true,
      actions: [{ label: "Edit", onClick: vi.fn() }],
    });

    scrollTableTo(100 * ROW_HEIGHT);
    // Let the virtualizer's "scrolling stopped" debounce land inside act()
    // before axe's async run, which would otherwise catch it outside.
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("leaves a consumer that does not opt in on the page-scroll, auto-layout path", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} getRowKey={(r) => r.id} />);

    const table = screen.getByRole("table");
    expect(table).not.toHaveClass("table-fixed");
    expect(table.querySelector("colgroup")).toBeNull();
    expect(table).not.toHaveAttribute("aria-rowcount");
    expect(screen.getAllByRole("row")[1]).not.toHaveAttribute("aria-rowindex");
    expect(document.querySelector("thead")).not.toHaveClass("sticky");

    // The wrapper keeps exactly its previous class list and gains no fixed height.
    const wrapper = table.parentElement as HTMLElement;
    expect(wrapper.className).toBe("overflow-x-auto");
    expect(wrapper).not.toHaveAttribute("style");

    // Every row is in the DOM, and none of them is a spacer.
    expect(screen.getAllByRole("row")).toHaveLength(ROWS.length + 1);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(ROWS.length);
  });
});
