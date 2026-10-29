import { Download as DownloadIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "../../../primitives/button";
import { useOpenUIRuntime } from "../../runtime-context";
import { defineOpenUIComponent } from "../../types";

const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

// Parse + exact-pathname match to block path-traversal and prefix-boundary bypasses.
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url, PLACEHOLDER_ORIGIN);
    if (parsed.origin !== PLACEHOLDER_ORIGIN) return false;
    return (
      parsed.pathname === "/api/ai/templates/render" ||
      parsed.pathname.startsWith("/api/ai/templates/starters/")
    );
  } catch {
    return false;
  }
}

function sanitizeFilename(stem: string): string {
  const replaced = stem.replace(/[^\w.-]/g, "_").slice(0, 64);
  return replaced.length > 0 ? replaced : "download";
}

function triggerBlobDownload(blob: Blob, filenameStem: string, extension: string): void {
  const safe = sanitizeFilename(filenameStem);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${safe}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export const Download = defineOpenUIComponent({
  name: "Download",
  props: z.object({
    label: z.string(),
    url: z.string(),
    filename: z.string(),
    format: z.enum(["md", "xlsx"]).optional(),
  }),
  description:
    "A download button that fetches a server-rendered file (.md or .xlsx) and saves it to the user's device. Use to deliver program setup files, starter templates, or other generated artifacts. `url` must be a relative path under `/api/ai/templates/render` or `/api/ai/templates/starters/`. `filename` is the file stem (no extension); the extension comes from `format` (default: md).",
  component: ({ props }) => {
    const runtime = useOpenUIRuntime();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const format = props.format ?? "md";

    const handleClick = async () => {
      setError(null);

      if (!isAllowedUrl(props.url)) {
        setError("Download blocked — URL is not an allowed templates endpoint.");
        return;
      }
      if (!runtime) {
        setError("Download is not available in this context.");
        return;
      }

      setPending(true);
      try {
        const headers: Record<string, string> = {};
        if (runtime.getToken) {
          const token = await runtime.getToken();
          headers["Authorization"] = `Bearer ${token}`;
        }
        // Trim trailing slash on baseUrl so we don't get `//api/...` if a caller passes `https://x.com/`.
        const fullUrl = `${runtime.baseUrl.replace(/\/$/, "")}${props.url}`;
        const res = await fetch(fullUrl, {
          headers,
          credentials: runtime.credentials,
        });
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string; message?: string };
            detail = body.error || body.message || detail;
          } catch {
            // Non-JSON error body — status line is the best we have.
          }
          setError(`Could not download "${props.filename}": ${detail}`);
          return;
        }
        const blob = await res.blob();
        triggerBlobDownload(blob, props.filename, format);
      } catch (err) {
        setError(
          `Could not download "${props.filename}": ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setPending(false);
      }
    };

    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={pending}
          aria-label={`Download ${props.filename}.${format}`}
          className="min-h-[44px]"
        >
          {pending ? (
            <Loader2 className="motion-safe:animate-spin" size="1em" aria-hidden="true" />
          ) : (
            <DownloadIcon size="1em" aria-hidden="true" />
          )}
          <span className="ml-2">{props.label}</span>
        </Button>
        {error && (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
});
