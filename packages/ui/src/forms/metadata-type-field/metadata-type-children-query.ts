/**
 * Shared query for "the types allowed directly below a metadata type".
 *
 * Every caller (MetadataTypeField's `childOf`, the hierarchy level picker, the
 * type relationship editor) uses this one factory so they share a single cache
 * entry per parent code, and one invalidation after a link change refreshes
 * them all. Each query walks every page, so a type with more than one page of
 * links never loses the tail.
 */

import {
  getMetadataManagementListMetadataTypeChildrenByCodeQueryKey,
  getMetadataManagementListMetadataTypeParentsByCodeQueryKey,
  metadataManagementListMetadataTypeChildrenByCode,
  metadataManagementListMetadataTypeParentsByCode,
  PLATFORM_MAX_PAGE_SIZE,
  type MetadataType,
} from "@loom-loyalty/sdk";

import { getInfiniteNextPageParam } from "../../hooks/infinite-query-helpers";

/**
 * First page at the platform maximum; it also keys the cache entry. A function,
 * not a constant, so that importing this module never reads the SDK (tests mock
 * it piecemeal).
 */
export function metadataTypeChildParams() {
  return { page: 0, size: PLATFORM_MAX_PAGE_SIZE };
}

type PagedTypes = { content?: MetadataType[]; pageNumber?: number; totalPages?: number };

/** Read every page of a related-types list; any failed page fails the whole read. */
async function readAllTypePages(
  fetchPage: (params: { page: number; size: number }) => Promise<{ data?: unknown }>,
  source: string
): Promise<MetadataType[]> {
  const first = metadataTypeChildParams();
  const types: MetadataType[] = [];
  let page: number | undefined = first.page;
  while (page !== undefined) {
    const response = await fetchPage({ page, size: first.size });
    const payload = response.data as PagedTypes | undefined;
    types.push(...(payload?.content ?? []));
    const next = getInfiniteNextPageParam({ data: payload }, source);
    // Stop on a server that repeats a page number rather than loop forever.
    page = next !== undefined && next > page ? next : undefined;
  }
  return types.filter((t) => t.code);
}

export function metadataTypeChildrenQueryKey(parentCode: string) {
  return getMetadataManagementListMetadataTypeChildrenByCodeQueryKey(
    parentCode,
    metadataTypeChildParams()
  );
}

export function metadataTypeChildrenQueryOptions(parentCode: string) {
  return {
    queryKey: metadataTypeChildrenQueryKey(parentCode),
    queryFn: (): Promise<MetadataType[]> =>
      readAllTypePages(
        (params) => metadataManagementListMetadataTypeChildrenByCode(parentCode, params),
        "metadata-type-children"
      ),
  };
}

/** The types this type may sit directly below (its parent types). */
export function metadataTypeParentsQueryKey(childCode: string) {
  return getMetadataManagementListMetadataTypeParentsByCodeQueryKey(
    childCode,
    metadataTypeChildParams()
  );
}

export function metadataTypeParentsQueryOptions(childCode: string) {
  return {
    queryKey: metadataTypeParentsQueryKey(childCode),
    queryFn: (): Promise<MetadataType[]> =>
      readAllTypePages(
        (params) => metadataManagementListMetadataTypeParentsByCode(childCode, params),
        "metadata-type-parents"
      ),
  };
}
