import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { sql, StandardSQL } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { placeholder as cmPlaceholder, EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { Loader2, Play } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export interface SqlEditorProps {
  /** Called when user runs the query (Cmd+Enter or Run button) */
  onRun: (sql: string) => void;
  /** Called when the editor content changes (typing, paste, etc.) */
  onChange?: (sql: string) => void;
  /** Whether a query is currently executing */
  isRunning?: boolean;
  /** Schema for auto-completion: { tableName: [columnNames] } */
  schema?: Record<string, string[]>;
  /** Placeholder text */
  placeholder?: string;
  /** Set this to a new value to replace the editor contents (e.g. template load) */
  externalValue?: string | null;
  /** Called after externalValue is consumed */
  onExternalValueConsumed?: () => void;
  /** Insert text at cursor position (used by schema browser click-to-insert) */
  insertAtCursor?: string | null;
  /** Called after insertAtCursor is consumed */
  onInsertConsumed?: () => void;
}

/**
 * SQL editor powered by CodeMirror 6 with syntax highlighting,
 * auto-completion, and Cmd+Enter to run.
 *
 * Uncontrolled: CodeMirror owns the text state. External changes
 * (templates, saved queries) are pushed in via externalValue prop.
 */
export function SqlEditor({
  onRun,
  onChange,
  isRunning = false,
  schema,
  placeholder = "SELECT * FROM mv_events LIMIT 100",
  externalValue,
  onExternalValueConsumed,
  insertAtCursor,
  onInsertConsumed,
}: SqlEditorProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /** Read current SQL from the editor */
  const getSql = (): string => viewRef.current?.state.doc.toString() ?? "";

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) return;

    const schemaMap: Record<string, string[]> = schema ?? {};

    const schemaCompletion = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/[\w.]*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      const options: Array<{ label: string; type: string; detail?: string }> = [];
      for (const [table, columns] of Object.entries(schemaMap)) {
        options.push({ label: table, type: "class", detail: "table" });
        for (const col of columns) {
          options.push({ label: col, type: "property", detail: table });
        }
      }
      return { from: word.from, options };
    };

    const runKeymap = keymap.of([
      {
        key: "Mod-Enter",
        run: (view) => {
          onRunRef.current(view.state.doc.toString());
          return true;
        },
      },
    ]);

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
      doc: "",
      extensions: [
        basicSetup,
        sql({ dialect: StandardSQL }),
        autocompletion({ override: [schemaCompletion] }),
        runKeymap,
        updateListener,
        theme,
        cmPlaceholder(placeholder),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate only when schema changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, placeholder]);

  // Push external value into editor (template load, saved query load)
  useEffect(() => {
    if (externalValue == null) return;
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: externalValue },
    });
    view.focus();
    onExternalValueConsumed?.();
  }, [externalValue, onExternalValueConsumed]);

  // Handle insert-at-cursor from schema browser
  useEffect(() => {
    if (!insertAtCursor || !viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, to: from, insert: insertAtCursor },
      selection: { anchor: from + insertAtCursor.length },
    });
    view.focus();
    onInsertConsumed?.();
  }, [insertAtCursor, onInsertConsumed]);

  return (
    <div className="border-border flex flex-col overflow-hidden rounded-lg border">
      <div ref={containerRef} className="bg-card max-h-[320px] min-h-[160px] overflow-auto" />
      <div className="border-border bg-muted/30 flex items-center justify-between border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">
          {isRunning ? "Running…" : "⌘+Enter to run"}
        </span>
        <button
          type="button"
          onClick={() => onRun(getSql())}
          disabled={isRunning}
          aria-busy={isRunning}
          aria-label={isRunning ? "Running query" : "Run query"}
          className="bg-primary hover:bg-primary-dark text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isRunning ? "Running…" : "Run Query"}
        </button>
      </div>
    </div>
  );
}
