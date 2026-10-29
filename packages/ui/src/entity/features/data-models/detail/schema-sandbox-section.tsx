import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../primitives/button.js";
import { Textarea } from "../../../../primitives/textarea.js";
import {
  validateJsonAgainstSchema,
  type SchemaValidationError,
  type SchemaValidationResult,
} from "../schema-utils.js";
import { Section } from "./section.js";

/**
 * Hard cap on the paste size we will validate. `validateJsonAgainstSchema`
 * runs `JSON.parse` → `ajv.compile` → `ajv.validate` synchronously on the
 * main thread, so a pathological 500KB+ paste freezes the tab for seconds.
 * 1MB is large enough for any realistic event payload and keeps the browser
 * responsive. The `maxLength` attribute enforces this at the DOM level on
 * both typing and paste.
 */
const MAX_SANDBOX_INPUT_BYTES = 1_000_000;

export function SchemaSandboxSection({ schema }: { schema: Record<string, unknown> }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SchemaValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const handleValidate = async () => {
    setValidating(true);
    try {
      const r = await validateJsonAgainstSchema(input, schema);
      if (!mountedRef.current) return;
      setResult(r);
    } finally {
      if (mountedRef.current) setValidating(false);
    }
  };

  return (
    <Section title="Validate Against Schema">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
        aria-expanded={expanded}
        aria-controls="data-model-schema-sandbox"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {expanded ? "Hide sandbox" : "Try a sample payload"}
      </button>
      {expanded && (
        <div id="data-model-schema-sandbox" className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"email": "user@example.com"}'
            aria-label="JSON payload to validate against schema"
            rows={6}
            maxLength={MAX_SANDBOX_INPUT_BYTES}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={!input.trim() || validating}
            >
              {validating ? "Validating…" : "Validate"}
            </Button>
            {result && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInput("");
                  setResult(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <div aria-live="polite" aria-atomic="true">
            {result && <ValidationResultDisplay result={result} />}
          </div>
        </div>
      )}
    </Section>
  );
}

function ValidationResultDisplay({ result }: { result: SchemaValidationResult }): ReactNode {
  if (result.parseError) {
    return (
      <div className="border-destructive/30 bg-destructive/5 rounded-md border p-3" role="alert">
        <p className="text-destructive flex items-center gap-1.5 text-sm">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Invalid JSON: <span className="font-mono text-xs">{result.parseError}</span>
        </p>
      </div>
    );
  }

  if (result.valid) {
    return (
      <div className="border-success/30 bg-success/5 rounded-md border p-3">
        <p className="text-success-dark flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Valid — all fields match the schema.
        </p>
      </div>
    );
  }

  return (
    <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-md border p-3">
      <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {result.errors.length} validation {result.errors.length === 1 ? "error" : "errors"}
      </p>
      <ul className="space-y-1">
        {result.errors.map((err, idx) => (
          <ValidationErrorRow key={idx} error={err} />
        ))}
      </ul>
    </div>
  );
}

function ValidationErrorRow({ error }: { error: SchemaValidationError }): ReactNode {
  return (
    <li className="text-destructive flex items-start gap-2 text-xs">
      <span className="font-mono">{error.path || "/"}</span>
      <span>{error.message}</span>
    </li>
  );
}
