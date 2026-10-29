/**
 * Display-time formatters shared by EntityList, EntityDetail, and EntityField.
 *
 * The schema-driven render path goes through three call sites that each had
 * the same locale-extraction guard duplicated. This module owns it.
 */

import { extractLocalizedString } from "@loom-loyalty/core";
import type { UIFieldConfig } from "@loom-loyalty/schema";
import type { ReactNode } from "react";

const EMPTY_PLACEHOLDER = <span className="text-muted-foreground">—</span>;

/**
 * For `locale-tabbed-input` widgets whose value is a record of locale codes,
 * return the en (or first available) locale value as a display string.
 *
 * Returns `null` when the field/value combination doesn't match — callers
 * should short-circuit on a non-null result and otherwise fall through to
 * their default formatting.
 */
export function formatLocalizedFieldValue(field: UIFieldConfig, value: unknown): ReactNode | null {
  if (field.widget !== "locale-tabbed-input") return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const extracted = extractLocalizedString(value as Record<string, unknown>);
  return extracted || EMPTY_PLACEHOLDER;
}
