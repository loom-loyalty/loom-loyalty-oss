import { type Accept, type FileRejection, useDropzone } from "react-dropzone";

import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";

export interface DropzoneProps {
  /** MIME type map — e.g. `{ "text/markdown": [".md", ".markdown"] }`. */
  accept?: Accept;
  /** Max file size in bytes. */
  maxSize?: number;
  /** Fired with accepted + rejected files. Single-file mode: `accepted` has at most one. */
  onDrop: (accepted: File[], rejected: FileRejection[]) => void;
  /** When true, shows the Skeleton/aria-busy state and disables interaction. */
  processing?: boolean;
  /** Live-region stage label while processing (e.g. "Parsing..."). */
  stageLabel?: string;
  /** Primary label announced to screen readers and rendered inside the zone. */
  label: string;
  /** Secondary guidance text. */
  description?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Dropzone({
  accept,
  maxSize,
  onDrop,
  processing = false,
  stageLabel,
  label,
  description,
  disabled = false,
  className,
  children,
}: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept,
    maxSize,
    disabled: disabled || processing,
    multiple: false,
    onDrop,
  });

  return (
    <div
      {...getRootProps()}
      role="button"
      aria-label={label}
      aria-busy={processing || undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 transition-all outline-none",
        "border-border bg-muted/30",
        isDragActive && !isDragReject && "border-primary shadow-primary/20 shadow-md",
        isDragReject && "border-destructive bg-destructive/5",
        !processing && !disabled && "hover:border-primary/60 hover:bg-muted/50 cursor-pointer",
        processing && "cursor-wait",
        disabled && "cursor-not-allowed opacity-60",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
    >
      <input {...getInputProps()} />
      {processing ? (
        <>
          <Skeleton className="h-6 w-40" />
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {stageLabel ?? "Processing..."}
          </p>
        </>
      ) : (
        <>
          <p className="text-foreground font-medium">{label}</p>
          {description ? (
            <p className="text-muted-foreground text-center text-sm">{description}</p>
          ) : null}
          {children}
        </>
      )}
    </div>
  );
}
