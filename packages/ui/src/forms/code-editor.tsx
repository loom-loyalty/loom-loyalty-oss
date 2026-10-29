import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { placeholder as cmPlaceholder, EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "../lib/utils";

export interface CodeEditorProps {
  /** Initial contents, applied once when the editor mounts. */
  initialValue?: string;
  /**
   * Set this to a new value to replace the editor contents (e.g. inject
   * AI-generated code). Pair with onExternalValueConsumed to reset the trigger.
   */
  externalValue?: string | null;
  /** Called after externalValue has been applied. */
  onExternalValueConsumed?: () => void;
  /** Called whenever the editor content changes (typing, paste, injection). */
  onChange?: (code: string) => void;
  /** Placeholder shown when the editor is empty. */
  placeholder?: string;
  /** Render the editor read-only (no editing, still selectable/copyable). */
  readOnly?: boolean;
  /** Accessible label for the editor's text input region. */
  ariaLabel?: string;
  /** id applied to the editing region so an external <label htmlFor> can target it. */
  id?: string;
  /** Extra classes for the editor viewport (e.g. height overrides). */
  className?: string;
}

/**
 * A JavaScript code editor powered by CodeMirror 6 — syntax highlighting,
 * line numbers, bracket matching, and the shared Geist Mono theme.
 *
 * Uncontrolled: CodeMirror owns the text state. Seed it once with initialValue
 * and push later replacements (e.g. AI-generated code) through externalValue.
 */
export function CodeEditor({
  initialValue = "",
  externalValue,
  onExternalValueConsumed,
  onChange,
  placeholder = "function handler(webhook) {\n  return webhook;\n}",
  readOnly = false,
  ariaLabel = "Code editor",
  id,
  className,
}: CodeEditorProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onExternalValueConsumedRef = useRef(onExternalValueConsumed);
  // Read once at mount so re-renders with a fresh initialValue don't recreate.
  const initialValueRef = useRef(initialValue);

  // Keep the latest callbacks in refs so the editor's listeners/injection call
  // the current handlers without rebuilding the editor or re-firing injection
  // when a parent passes inline (unstable) callbacks.
  useEffect(() => {
    onChangeRef.current = onChange;
    onExternalValueConsumedRef.current = onExternalValueConsumed;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString());
      }
    });

    const theme = EditorView.theme({
      "&": {
        fontSize: "13px",
        fontFamily: "'Geist Mono', monospace",
      },
      ".cm-content": {
        caretColor: "var(--primary)",
        padding: "12px 0",
      },
      ".cm-line": {
        padding: "0 12px",
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: "var(--primary)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "oklch(from var(--primary) l c h / 0.1)",
      },
      ".cm-activeLine": {
        backgroundColor: "oklch(from var(--muted) l c h / 0.3)",
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        borderRight: "1px solid var(--border)",
        color: "var(--muted-foreground)",
        fontSize: "12px",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--foreground)",
      },
      "&.cm-focused": {
        outline: "none",
      },
    });

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        javascript(),
        updateListener,
        theme,
        cmPlaceholder(placeholder),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": ariaLabel,
          ...(id ? { id } : {}),
        }),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate only when the static configuration changes; doc/onChange flow
    // through refs so edits never rebuild the editor.
  }, [placeholder, readOnly, ariaLabel, id]);

  // Push an external value into the editor (e.g. AI-generated code). Keyed only
  // on externalValue: the consumer callback is read from a ref so an inline
  // callback re-render can't re-fire the injection.
  useEffect(() => {
    if (externalValue == null) return;
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: externalValue },
    });
    view.focus();
    onExternalValueConsumedRef.current?.();
  }, [externalValue]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div
        ref={containerRef}
        className={cn("bg-card max-h-[420px] min-h-[200px] overflow-auto", className)}
      />
    </div>
  );
}
