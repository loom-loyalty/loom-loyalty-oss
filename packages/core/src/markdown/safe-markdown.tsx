import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

import { SAFE_MARKDOWN_ALLOWED_ELEMENTS, safeMarkdownUrlTransform } from "../utils/localized-text";

const ALLOWED_ELEMENTS = [...SAFE_MARKDOWN_ALLOWED_ELEMENTS];

export interface SafeMarkdownProps {
  /** The tenant's text: basic Markdown, or legacy plain text. */
  text: string;
  /** Classes for the wrapper (type size, colour). */
  className?: string;
  /** Classes for links and bold text, so each app keeps its own tokens. */
  classNames?: { link?: string; strong?: string };
}

/**
 * A tenant's basic Markdown (paragraphs, bold, italic, lists, https and mailto links), rendered
 * locked down: raw HTML is skipped, never rendered or run; any other element is unwrapped to its
 * text; any other link scheme is dropped to its text. The Rewards Portal renders it and the
 * dashboard previews it with this one component, so the preview is what members see.
 */
export function SafeMarkdown({ text, className, classNames }: SafeMarkdownProps) {
  const components: ComponentProps<typeof ReactMarkdown>["components"] = {
    // pre-wrap keeps a plain text's single line breaks, as before Markdown.
    p: ({ children }) => <p className="mt-3 whitespace-pre-wrap first:mt-0">{children}</p>,
    ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
    ol: ({ children }) => (
      <ol className="mt-3 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>
    ),
    strong: ({ children }) => (
      <strong className={["font-semibold", classNames?.strong].filter(Boolean).join(" ")}>
        {children}
      </strong>
    ),
    // urlTransform empties any link that isn't https or mailto: such a link is just its text.
    a: ({ href, children }) => {
      if (!href) return <>{children}</>;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={["underline underline-offset-2", classNames?.link].filter(Boolean).join(" ")}
        >
          {children || href}
          {/* The space sits outside the span: accessible-name computation trims a child's own edges. */}{" "}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      );
    },
  };

  return (
    <div className={["break-words", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        skipHtml
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={safeMarkdownUrlTransform}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
