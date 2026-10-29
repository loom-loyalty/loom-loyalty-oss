/**
 * Generic Spring-style paginated-list MSW handler factory.
 *
 * Slices `items` by `?page=` and `?size=` query params and returns a body
 * matching the `PagedXData` shape orval emits for every list endpoint:
 *
 *   { content, totalSize, totalPages, pageNumber, pageSize }
 *
 * `pageable` is omitted — wrappers don't read it. An optional `filter`
 * callback supports the rare server-side filter (e.g., `useOfferManagementListOffers`
 * accepts `?name=`).
 *
 * Like the Platform API, a `size` above {@link PLATFORM_MAX_PAGE_SIZE} gets a
 * 400, so a component asking for more than one page allows fails its test.
 */

import { http, HttpResponse, type HttpHandler, type PathParams } from "msw";

/** Largest `size` the Platform API accepts on a list endpoint. */
export const PLATFORM_MAX_PAGE_SIZE = 100;

export interface PaginatedListBody<T> {
  content: T[];
  totalSize: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
}

export interface PaginatedListHandlerOptions<T> {
  url: string | RegExp;
  items: T[];
  defaultPageSize?: number;
  /** Optional filter applied before pagination (e.g., for `?name=` server search). */
  filter?: (item: T, params: URLSearchParams) => boolean;
}

export function paginatedListHandler<T>({
  url,
  items,
  defaultPageSize = 50,
  filter,
}: PaginatedListHandlerOptions<T>): HttpHandler {
  return http.get<PathParams, never, PaginatedListBody<T> | ValidationErrorBody>(
    url,
    ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = parsePositiveInt(params.get("page"), 0);
      const size = parsePositiveInt(params.get("size"), defaultPageSize);
      if (size > PLATFORM_MAX_PAGE_SIZE) {
        return HttpResponse.json(
          { message: `size must be at most ${String(PLATFORM_MAX_PAGE_SIZE)}` },
          { status: 400 }
        );
      }

      const filtered = filter ? items.filter((item) => filter(item, params)) : items;
      const totalSize = filtered.length;
      const totalPages = size > 0 ? Math.ceil(totalSize / size) : 0;
      const start = page * size;
      const content = filtered.slice(start, start + size);

      return HttpResponse.json({
        content,
        totalSize,
        totalPages,
        pageNumber: page,
        pageSize: size,
      });
    }
  );
}

interface ValidationErrorBody {
  message: string;
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
