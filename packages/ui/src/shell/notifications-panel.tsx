import { formatRelativeTime } from "@loom-loyalty/core";
import type {
  NotificationFeedItem,
  NotificationFeedStatus,
} from "@loom-loyalty/core/notifications";
import { Archive, BellOff } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { badgeVariants } from "../primitives/badge";
import { Skeleton } from "../primitives/skeleton";

export interface NotificationsPanelProps {
  status: NotificationFeedStatus;
  items: NotificationFeedItem[];
  unreadCount: number;
  /** Called when an item is chosen. The app marks it read and follows its link. */
  onOpenItem?: (item: NotificationFeedItem) => void;
  onMarkAllRead?: () => void;
  onArchive?: (id: string) => void;
  className?: string;
}

/**
 * The signed-in user's notification inbox, shown in the header bell's popover.
 * Presentational: the app passes the feed from `useNotificationFeed()`.
 */
export function NotificationsPanel({
  status,
  items,
  unreadCount,
  onOpenItem,
  onMarkAllRead,
  onArchive,
  className,
}: NotificationsPanelProps) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  // Archiving removes the focused row, so focus moves to its neighbour (or the
  // heading) once the feed drops it.
  const pendingFocus = React.useRef<{ archivedId: string; nextId: string | null } | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const nothingUnread = unreadCount === 0;

  React.useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || items.some((item) => item.id === pending.archivedId)) return;
    pendingFocus.current = null;
    const next = pending.nextId
      ? listRef.current?.querySelector<HTMLElement>(
          `li[data-notification-id="${CSS.escape(pending.nextId)}"] button`
        )
      : null;
    (next ?? headingRef.current)?.focus();
  }, [items]);

  const handleMarkAllRead = () => {
    if (nothingUnread) return;
    onMarkAllRead?.();
    setAnnouncement("All notifications marked as read.");
  };

  const handleArchive = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    const neighbour = items[index + 1] ?? items[index - 1];
    pendingFocus.current = { archivedId: id, nextId: neighbour?.id ?? null };
    onArchive?.(id);
    setAnnouncement("Notification archived.");
  };

  return (
    <div className={cn("flex max-h-[28rem] flex-col", className)}>
      <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-foreground text-sm font-semibold focus-visible:outline-none"
        >
          Notifications
        </h2>
        {status === "ready" && items.length > 0 && (
          // aria-disabled rather than disabled, so the button keeps focus once
          // everything is read.
          <button
            type="button"
            onClick={handleMarkAllRead}
            aria-disabled={nothingUnread}
            className="text-primary-dark focus-visible:ring-ring hover:bg-foreground/5 min-h-11 rounded-md px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
          >
            Mark all as read
          </button>
        )}
      </header>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === "loading" && <LoadingRows />}
        {status === "error" && (
          <p role="alert" className="text-status-error-fg px-4 py-6 text-sm">
            We couldn&apos;t load your notifications. Try again in a moment.
          </p>
        )}
        {status === "disabled" && (
          <EmptyState text="Notifications aren't available for this environment." />
        )}
        {status === "ready" && items.length === 0 && <EmptyState text="You're all caught up." />}
        {status === "ready" && items.length > 0 && (
          <ul ref={listRef} className="divide-border divide-y">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={onOpenItem}
                onArchive={onArchive ? handleArchive : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onOpen,
  onArchive,
}: {
  item: NotificationFeedItem;
  onOpen?: (item: NotificationFeedItem) => void;
  onArchive?: (id: string) => void;
}) {
  const when = formatRelativeTime(item.createdAt);
  const content = (
    <>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            item.read ? "bg-transparent" : "bg-accent"
          )}
        />
        <span
          className={cn(
            "text-foreground line-clamp-2 text-sm",
            item.read ? "font-normal" : "font-semibold"
          )}
        >
          {item.title}
        </span>
      </span>
      {item.body && (
        <span className="text-muted-foreground line-clamp-2 pl-4 text-sm">{item.body}</span>
      )}
      <span className="flex items-center gap-2 pl-4">
        {when && <span className="text-muted-foreground text-xs">{when}</span>}
        {item.done ? (
          <span className={badgeVariants({ variant: "success" })}>Done</span>
        ) : (
          item.actionKind === "action" && (
            <span className={badgeVariants({ variant: "warning" })}>Action needed</span>
          )
        )}
        {!item.read && <span className="sr-only">Unread</span>}
      </span>
    </>
  );

  return (
    <li
      data-notification-id={item.id}
      className={cn("flex items-start gap-1 pr-2", !item.read && "bg-primary/5")}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="focus-visible:ring-ring hover:bg-foreground/5 flex min-h-11 flex-1 flex-col items-stretch gap-1 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          {content}
        </button>
      ) : (
        <div className="flex flex-1 flex-col gap-1 px-4 py-3">{content}</div>
      )}
      {onArchive && (
        <button
          type="button"
          onClick={() => onArchive(item.id)}
          aria-label={`Archive "${item.title}"`}
          className="text-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function LoadingRows() {
  return (
    <div role="status" aria-busy="true" className="space-y-4 px-4 py-4">
      <span className="sr-only">Loading notifications</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
      <BellOff className="h-5 w-5" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
