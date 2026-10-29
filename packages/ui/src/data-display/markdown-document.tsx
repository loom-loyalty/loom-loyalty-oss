import { type ComponentProps, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeHref } from "../lib/safe-href";
import { cn } from "../lib/utils";

// Prose typography for long-form markdown such as a contract or policy. Raw HTML
// is never rendered (react-markdown's default), links pass through safeHref, and
// images are dropped so a preview never auto-loads a remote URL.
const MARKDOWN_COMPONENTS: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h2 className="text-foreground mt-6 text-xl font-semibold first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-foreground mt-6 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-foreground mt-5 text-base font-semibold first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="text-foreground mt-4 text-sm font-semibold first:mt-0">{children}</h5>
  ),
  h5: ({ children }) => (
    <h6 className="text-foreground mt-4 text-sm font-semibold first:mt-0">{children}</h6>
  ),
  h6: ({ children }) => (
    <h6 className="text-foreground mt-4 text-sm font-semibold first:mt-0">{children}</h6>
  ),
  p: ({ children }) => <p className="mt-3 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground mt-3 border-l-2 pl-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-6" />,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  pre: ({ children }) => (
    <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8125rem]">{children}</code>
  ),
  table: ({ children }) => (
    // Focusable so a keyboard user can scroll a wide table.
    <div
      role="region"
      aria-label="Table"
      tabIndex={0}
      className="focus-visible:ring-ring mt-3 overflow-x-auto rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="border-border w-full border-collapse border text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th scope="col" className="border-border bg-muted border px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-border border px-2 py-1 align-top">{children}</td>,
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

export interface MarkdownDocumentProps {
  /** Markdown source. Raw HTML and images are not rendered. */
  content: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm];
const DISALLOWED_ELEMENTS = ["img"];

/**
 * Renders a long-form markdown document (headings, lists, tables, links) as
 * prose. Headings drop one level so a document's h1 sits under the page title.
 * Memoized: re-parsing a long contract on every parent render is noticeable.
 */
export const MarkdownDocument = memo(function MarkdownDocument({
  content,
  className,
}: MarkdownDocumentProps) {
  return (
    <div className={cn("text-foreground text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        disallowedElements={DISALLOWED_ELEMENTS}
        unwrapDisallowed
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
