import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useClampListPage } from "./use-clamp-list-page";

const base = { pageSize: 25, ready: true };

describe("useClampListPage", () => {
  it("moves a stale page back to the last page that exists", () => {
    const setPage = vi.fn();
    renderHook(() => useClampListPage({ ...base, page: 9, total: 60, rowsOnPage: 0, setPage }));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it("steps back one page when a floor total led past the end", () => {
    const setPage = vi.fn();
    // 50 rows known as a floor; page 3 came back empty.
    renderHook(() => useClampListPage({ ...base, page: 3, total: 50, rowsOnPage: 0, setPage }));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it("goes to page 1 when the list is now empty", () => {
    const setPage = vi.fn();
    renderHook(() => useClampListPage({ ...base, page: 4, total: 0, rowsOnPage: 0, setPage }));
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it("leaves a page with rows, page 1, and a loading page alone", () => {
    const setPage = vi.fn();
    renderHook(() => useClampListPage({ ...base, page: 2, total: 60, rowsOnPage: 10, setPage }));
    renderHook(() => useClampListPage({ ...base, page: 1, total: 0, rowsOnPage: 0, setPage }));
    renderHook(() =>
      useClampListPage({ ...base, ready: false, page: 5, total: 0, rowsOnPage: 0, setPage })
    );
    expect(setPage).not.toHaveBeenCalled();
  });
});
