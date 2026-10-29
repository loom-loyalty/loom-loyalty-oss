import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import { z } from "zod";

import { safeHref } from "../../../lib/safe-href";
import { cn } from "../../../lib/utils";
import { defineOpenUIComponent } from "../../types";

// Prose typography for model-written markdown. No raw HTML (react-markdown's
// default), links pass through safeHref, and images are dropped: the text is
// model output, and an auto-loading image URL could carry data out.
const MARKDOWN_COMPONENTS: ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-3">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8125rem]">{children}</code>
  ),
  a: ({ href, children }) => {
    const safe = typeof href === "string" ? safeHref(href) : undefined;
    if (!safe) return <>{children}</>;
    return (
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-dark underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
};

export const Text = defineOpenUIComponent({
  name: "Text",
  props: z.object({
    content: z.string(),
    tone: z.enum(["default", "muted"]).optional(),
  }),
  description:
    "Plain prose with no container, for any sentence or paragraph in a reply: answers, explanations, next steps. Supports markdown (bold, italic, inline code, lists, links). The default for text; use Card or Alert only when content needs a boundary.",
  component: ({ props }) => (
    <div
      className={cn(
        "text-sm leading-relaxed",
        props.tone === "muted" ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <ReactMarkdown disallowedElements={["img"]} unwrapDisallowed components={MARKDOWN_COMPONENTS}>
        {props.content ?? ""}
      </ReactMarkdown>
    </div>
  ),
});
