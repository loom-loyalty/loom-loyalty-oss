// Shared inert mocks for useListControls + useSavedViews so list-page component tests
// don't each duplicate 50+ lines and don't drift as the ListControls interface evolves.
// Variable names start with `mock` so vitest's vi.mock factory hoisting accepts them.

import { vi } from "vitest";

export const mockListControlsResult = {
  searchInput: "",
  filters: {} as Record<string, string | string[]>,
  sort: undefined,
  page: 1,
  pageSize: 25,
  setSearch: vi.fn(),
  setFilter: vi.fn(),
  toggleFilterValue: vi.fn(),
  setSort: vi.fn(),
  setPage: vi.fn(),
  setPageSize: vi.fn(),
  clearAll: vi.fn(),
  hasActiveFilters: false,
  hasCommittedState: false,
  filterBarProps: {
    searchValue: "",
    onSearchChange: vi.fn(),
    onClearAll: vi.fn(),
    showClear: false,
  },
  buildFilterConfigs: () => [],
  paginationProps: (total: number) => ({
    page: 1,
    pageSize: 25,
    total,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  }),
  queryArgs: {
    pagination: { page: 1, pageSize: 25 },
    search: undefined,
    sort: undefined,
    filters: {} as Record<string, unknown>,
    enabled: true,
  },
  currentSearch: {} as Record<string, unknown>,
  applySearch: vi.fn(),
};

export const mockSavedViewsResult = {
  views: [] as never[],
  activeViewId: null,
  saveCurrentAs: vi.fn(),
  applyView: vi.fn(),
  deleteView: vi.fn(),
};
