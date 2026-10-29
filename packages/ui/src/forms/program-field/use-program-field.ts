/**
 * Hook for fetching and creating programs. Server-paginated; a debounced
 * search term goes to the list endpoint's `search` param (name/code), and the
 * same substring filter narrows rows until the server answers. Defensive against the
 * BE occasionally returning a bare `Program[]` instead of a paged envelope.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  getProgramManagementListProgramsQueryKey,
  programManagementListPrograms,
  useProgramManagementCreateProgram,
  type CreateProgram,
  type Program,
} from "@loom-loyalty/sdk";

import { resetInfiniteQueryToFirstPage } from "../../hooks/infinite-query-helpers";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchProgramPage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  programManagementListPrograms({ page, size, ...(search ? { search } : {}) });

const matchesProgram = (program: Program, needle: string): boolean =>
  !needle ||
  (program.name?.toLowerCase() ?? "").includes(needle) ||
  (program.code?.toLowerCase() ?? "").includes(needle);

const programKey = (program: Program) => program.programId ?? program.code;

export interface UseProgramFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseProgramFieldReturn {
  options: EntityOption[];
  /** All loaded programs as EntityOptions, regardless of search. Use for badge/trigger lookup. */
  optionsAll: EntityOption[];
  programs: Program[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  createProgram: (data: CreateProgram) => Promise<Program>;
  isCreating: boolean;
  createError: Error | null;
  findProgram: (id: string) => Program | undefined;
}

export function useProgramField(options?: UseProgramFieldOptions): UseProgramFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredPrograms,
    rows: programs,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<Program>({
    queryKey: getProgramManagementListProgramsQueryKey(),
    fetchPage: fetchProgramPage,
    pageSize,
    search: debouncedSearch,
    filter: matchesProgram,
    getKey: programKey,
    enabled,
    source: "program-field",
  });

  const createMutation = useProgramManagementCreateProgram({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(queryClient, getProgramManagementListProgramsQueryKey());
      },
    },
  });

  const toOption = (program: Program): EntityOption | null => {
    const id = program.programId ?? program.code;
    return id != null ? { id, name: program.name, secondaryText: program.code } : null;
  };

  const optionsAll = useMemo<EntityOption[]>(
    () => programs.map(toOption).filter((o): o is EntityOption => o !== null),
    [programs]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredPrograms.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredPrograms]
  );

  const createProgram = async (input: CreateProgram): Promise<Program> => {
    const response = await createMutation.mutateAsync({ data: input });
    return response.data as Program;
  };

  const findProgram = (id: string): Program | undefined => {
    return programs.find((p) => (p.programId ?? p.code) === id);
  };

  return {
    options: optionsList,
    optionsAll,
    programs,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: programs.length,
    totalAvailable,
    createProgram,
    isCreating: createMutation.isPending,
    createError: (createMutation.error ?? null) as Error | null,
    findProgram,
  };
}
