import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../../primitives/button.js";
import { copyToClipboard, formatJson } from "../schema-utils.js";
import { Section } from "./section.js";

export function JsonSchemaSection({ schema }: { schema: Record<string, unknown> }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonString = useMemo(() => formatJson(schema), [schema]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(jsonString);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Section
      title="JSON Schema"
      action={
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied!" : "Copy"}
        </Button>
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
        aria-expanded={expanded}
        aria-controls="data-model-json-schema"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {expanded ? "Hide schema" : "Show schema"}
      </button>
      {expanded && (
        <pre
          id="data-model-json-schema"
          className="border-border bg-muted/50 max-h-80 overflow-auto rounded-md border p-3 font-mono text-xs"
        >
          <code>{jsonString}</code>
        </pre>
      )}
    </Section>
  );
}
