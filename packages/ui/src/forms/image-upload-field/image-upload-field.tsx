"use client";

import { ImageOff, Upload } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";

export interface ImageUploadFieldProps {
  label: string;
  /** The image URL. */
  value: string;
  onChange: (url: string) => void;
  /**
   * Uploads the chosen file and resolves to its URL, which becomes the field's value. Leave it out where uploads are
   * unavailable: the field is then a plain URL input.
   */
  onUpload?: (file: File) => Promise<string>;
  /** Turns an upload failure into the message shown under the field. */
  describeUploadError?: (error: unknown) => string;
  /** Media types the file picker offers. */
  accept?: string;
  helperText?: ReactNode;
  placeholder?: string;
  /** A validation message for the URL itself. */
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * An image URL field with an Upload button and a preview. The URL stays editable, so a hosted image can still be
 * linked; an upload fills the field with the stored file's URL.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  onUpload,
  describeUploadError,
  accept = DEFAULT_ACCEPT,
  helperText,
  placeholder = "https://",
  error,
  disabled,
  id,
  className,
}: ImageUploadFieldProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const brokenId = `${inputId}-broken`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brokenPreview, setBrokenPreview] = useState<string | null>(null);

  const message = uploadError ?? error;
  const trimmed = value.trim();
  const showPreview = trimmed.length > 0;
  const previewBroken = brokenPreview === trimmed;
  const showBroken = previewBroken && !message;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file || !onUpload) return;
    setUploadError(null);
    setUploading(true);
    try {
      onChange(await onUpload(file));
    } catch (err) {
      setUploadError(
        describeUploadError?.(err) ?? (err instanceof Error ? err.message : "The upload failed")
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-widget="image-upload-field" className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-start gap-3">
        <div
          className="border-border bg-muted flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border"
          aria-hidden={!showPreview || previewBroken}
        >
          {showPreview && !previewBroken ? (
            <img
              src={trimmed}
              alt={`${label} preview`}
              className="size-full object-contain"
              onError={() => setBrokenPreview(trimmed)}
            />
          ) : (
            <ImageOff className="text-muted-foreground size-4" aria-hidden="true" />
          )}
        </div>
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setUploadError(null);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          disabled={disabled || uploading}
          aria-invalid={message ? true : undefined}
          aria-describedby={
            [
              showBroken ? brokenId : undefined,
              helperText ? helperId : undefined,
              message ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="min-h-11 min-w-0 flex-1"
        />
        {onUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFile}
              disabled={disabled || uploading}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              aria-label={`Upload ${label}`}
              onClick={() => {
                if (!uploading) fileInputRef.current?.click();
              }}
              // Stays focusable while uploading (aria-disabled, not disabled), so keyboard focus is not dropped.
              disabled={disabled}
              aria-disabled={uploading || undefined}
              aria-busy={uploading || undefined}
            >
              <Upload className="size-4" aria-hidden="true" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {uploading ? `Uploading ${label}…` : ""}
      </p>
      {showBroken && (
        <p id={brokenId} className="text-muted-foreground text-xs" role="status">
          This image can&apos;t be loaded.
        </p>
      )}
      {helperText && (
        <p id={helperId} className="text-muted-foreground text-xs">
          {helperText}
        </p>
      )}
      {message && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
