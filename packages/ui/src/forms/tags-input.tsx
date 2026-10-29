/**
 * TagsInput
 *
 * A text input that converts comma-separated or Enter-delimited values into
 * removable badge chips. Pressing Backspace on an empty input removes the
 * last tag.
 */

"use client";

import { X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";

export interface TagsInputProps {
  /** Field label */
  label?: string;
  /** Current tag values */
  value?: string[];
  /** Called when the tag list changes */
  onChange?: (value: string[]) => void;
  /** Placeholder for the text input */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** ARIA label */
  "aria-label"?: string;
}

/**
 * TagsInput - Text input that collects values as badge chips.
 *
 * @example
 * ```tsx
 * const [tags, setTags] = useState<string[]>([]);
 *
 * <TagsInput
 *   label="Keywords"
 *   value={tags}
 *   onChange={setTags}
 *   placeholder="Type and press Enter..."
 * />
 * ```
 */
export function TagsInput({
  label,
  value = [],
  onChange,
  placeholder = "Type and press Enter...",
  disabled = false,
  "aria-label": ariaLabel,
}: TagsInputProps) {
  const id = useId();
  const inputId = `${id}-tags`;
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed || value.includes(trimmed)) return;
      onChange?.([...value, trimmed]);
    },
    [value, onChange]
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange?.(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
          setInputValue("");
        }
      } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
        removeTag(value.length - 1);
      }
    },
    [inputValue, addTag, removeTag, value.length]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // If user pastes text with commas, split into multiple tags
      if (raw.includes(",")) {
        const parts = raw.split(",");
        // Add all but the last part as tags (last part stays in input)
        for (const part of parts.slice(0, -1)) {
          const trimmed = part.trim();
          if (trimmed) {
            addTag(trimmed);
          }
        }
        setInputValue(parts[parts.length - 1] || "");
      } else {
        setInputValue(raw);
      }
    },
    [addTag]
  );

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}

      <div
        className={cn(
          "border-input-border bg-input flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-3 py-1.5",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label={ariaLabel ?? label ?? "Tags"}
      >
        {value.map((tag, index) => (
          <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              disabled={disabled}
              className="hover:bg-muted-foreground/20 focus:ring-ring ml-0.5 rounded-full p-0.5 transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:pointer-events-none"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : undefined}
          disabled={disabled}
          className="h-7 min-w-[80px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          aria-label={ariaLabel ?? label ?? "Add tag"}
        />
      </div>
    </div>
  );
}
