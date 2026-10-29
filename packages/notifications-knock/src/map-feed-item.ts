import type { FeedItem } from "@knocklabs/client";
import type { NotificationFeedItem, NotificationLink } from "@loom-loyalty/core/notifications";

/** Workflows whose item asks the recipient to do something; an interaction marks it done. */
const ACTION_WORKFLOWS = new Set(["approval-requested"]);

/**
 * Turns a Knock feed item into the app's provider-neutral item. The in-app
 * template writes the title as the body's first paragraph (or in a `title`
 * block), and the rest is the body.
 */
export function mapFeedItem(item: FeedItem): NotificationFeedItem {
  const { title, body } = titleAndBody(item);
  const actionKind = ACTION_WORKFLOWS.has(item.source?.key ?? "") ? "action" : "info";
  return {
    id: item.id,
    title,
    body,
    createdAt: item.inserted_at,
    read: item.read_at !== null,
    done: actionKind === "action" && item.interacted_at !== null,
    actionKind,
    link: linkFrom(item.data),
  };
}

function titleAndBody(item: FeedItem): { title: string; body?: string } {
  // Each block's text as paragraphs of plain words. `content` is the template source, so it is the fallback:
  // `rendered` has the variables filled in (HTML for a markdown block) and needs no markdown stripping, which
  // would also eat literal `*` or `_` in the data.
  const paragraphsOf = (name: string): string[] => {
    const block = item.blocks.find((b) => b.name === name);
    if (!block || !("content" in block)) {
      return [];
    }
    const rendered = block.rendered?.trim();
    const [source, clean] = rendered
      ? [block.type === "markdown" ? htmlText(rendered) : rendered, collapse]
      : [block.content, plain];
    return source
      .split(/\n\s*\n/)
      .map((p) => clean(p))
      .filter(Boolean);
  };
  const explicitTitle = paragraphsOf("title").join(" ");
  const paragraphs = paragraphsOf("body");
  if (explicitTitle) {
    return { title: explicitTitle, body: paragraphs.join("\n") || undefined };
  }
  const [first, ...rest] = paragraphs;
  return { title: first ?? "Notification", body: rest.join("\n") || undefined };
}

/** Turns a rendered markdown block back into text, keeping a blank line between paragraphs. */
function htmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Strips the markdown a feed template uses for emphasis and links, keeping the words. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*(?:#{1,6}|>)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function linkFrom(data: Record<string, unknown> | null): NotificationLink | undefined {
  const hubPath = data?.hubPath;
  if (typeof hubPath === "string" && hubPath.startsWith("/")) {
    return { app: "hub", path: hubPath };
  }
  const dashboardPath = data?.dashboardPath;
  if (typeof dashboardPath === "string" && dashboardPath.startsWith("/")) {
    return { app: "dashboard", path: dashboardPath };
  }
  return undefined;
}
