"use client";

import * as React from "react";

export interface InfiniteScrollSentinelOptions {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

/** Callback ref for a bottom-of-list sentinel; fires `onLoadMore` on intersect or on settle-still-visible. */
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: InfiniteScrollSentinelOptions): (node: Element | null) => void {
  const optsRef = React.useRef({ hasNextPage, isFetchingNextPage, onLoadMore });
  optsRef.current = { hasNextPage, isFetchingNextPage, onLoadMore };

  const intersectingRef = React.useRef(false);
  const [node, setNode] = React.useState<Element | null>(null);

  React.useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      const opts = optsRef.current;
      const isIntersecting = entries.some((entry) => entry.isIntersecting);
      intersectingRef.current = isIntersecting;
      if (isIntersecting && opts.hasNextPage && !opts.isFetchingNextPage) {
        opts.onLoadMore?.();
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  React.useEffect(() => {
    if (isFetchingNextPage) return;
    if (!hasNextPage) return;
    if (!intersectingRef.current) return;
    optsRef.current.onLoadMore?.();
  }, [isFetchingNextPage, hasNextPage]);

  return setNode;
}
