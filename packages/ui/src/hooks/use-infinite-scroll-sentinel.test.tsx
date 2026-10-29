import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetIntersectionObservers, triggerIntersection } from "../test/intersection-observer";
import { useInfiniteScrollSentinel } from "./use-infinite-scroll-sentinel";

interface HarnessProps {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

function Harness({ hasNextPage, isFetchingNextPage, onLoadMore }: HarnessProps) {
  const setSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });
  return <div ref={setSentinel} data-testid="sentinel" />;
}

describe("[audit] useInfiniteScrollSentinel", () => {
  afterEach(() => {
    resetIntersectionObservers();
  });

  it("calls onLoadMore when the sentinel intersects and hasNextPage is true", () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage onLoadMore={onLoadMore} />);

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not fire when hasNextPage is false", () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage={false} onLoadMore={onLoadMore} />);

    triggerIntersection(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not fire while a fetch is already in flight", () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);

    triggerIntersection(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not fire when the entry is not intersecting", () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage onLoadMore={onLoadMore} />);

    triggerIntersection(false);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("disconnects on unmount so stale callbacks don't fire", () => {
    const onLoadMore = vi.fn();
    const { unmount } = render(<Harness hasNextPage onLoadMore={onLoadMore} />);

    unmount();
    triggerIntersection(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("reads the latest props after a re-render (no stale closure)", () => {
    const initial = vi.fn();
    const replacement = vi.fn();

    const { rerender } = render(<Harness hasNextPage onLoadMore={initial} />);
    rerender(<Harness hasNextPage onLoadMore={replacement} />);

    triggerIntersection(true);
    expect(initial).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it("auto-fires onLoadMore again when the prior fetch settles and the sentinel is still intersecting (deadlock)", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <Harness hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />
    );

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<Harness hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Harness hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("does not re-fire on settle when hasNextPage has gone false", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <Harness hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />
    );

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<Harness hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Harness hasNextPage={false} isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire on settle when the sentinel is no longer intersecting", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <Harness hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />
    );

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<Harness hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);
    triggerIntersection(false);
    rerender(<Harness hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
