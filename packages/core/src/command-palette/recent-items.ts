/**
 * Per-viewer "Recent" list for the command palette. Stored in browser storage, keyed by
 * app, user and organization environment, so one org's items never show in another.
 * Only the ID, label, type and URL are stored. Every storage access is guarded: in
 * private mode or with blocked site data the list is simply empty.
 */

export const MAX_RECENT_ITEMS = 5;
const STORAGE_PREFIX = "loom-command-palette-recent";
const STORAGE_VERSION = 1;
const MAX_FIELD_LENGTH = 500;

export interface CommandPaletteRecentItem {
  entityId: string;
  entityType: string;
  displayLabel: string;
  sourceUrl?: string;
}

/** Returns the storage key, or null until both the user and environment are known. */
export function buildRecentItemsKey(
  app: string,
  userId: string | null | undefined,
  organizationEnvironmentId: string | null | undefined
): string | null {
  if (!userId || !organizationEnvironmentId) return null;
  // Encode each part so no two (user, environment) pairs can produce the same key.
  return [STORAGE_PREFIX, app, userId, organizationEnvironmentId].map(encodeURIComponent).join(":");
}

/** Adds an item to the front, dropping an older copy of it and anything past the cap. */
export function rememberRecentItem(
  list: CommandPaletteRecentItem[],
  next: CommandPaletteRecentItem
): CommandPaletteRecentItem[] {
  const entry = pick(next);
  return [entry, ...list.filter((existing) => existing.entityId !== entry.entityId)].slice(
    0,
    MAX_RECENT_ITEMS
  );
}

export function readRecentItems(key: string | null): CommandPaletteRecentItem[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredShape(parsed)) {
      safeRemove(key);
      return [];
    }
    return parsed.items.slice(0, MAX_RECENT_ITEMS);
  } catch {
    safeRemove(key);
    return [];
  }
}

export function writeRecentItems(key: string | null, items: CommandPaletteRecentItem[]): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: STORAGE_VERSION,
        items: items.slice(0, MAX_RECENT_ITEMS).map(pick),
      })
    );
  } catch {
    // Private mode or quota: the list just isn't remembered.
  }
}

function pick(item: CommandPaletteRecentItem): CommandPaletteRecentItem {
  const entry: CommandPaletteRecentItem = {
    entityId: item.entityId,
    entityType: item.entityType,
    displayLabel: item.displayLabel,
  };
  if (item.sourceUrl) entry.sourceUrl = item.sourceUrl;
  return entry;
}

function isShortString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_FIELD_LENGTH;
}

function isRecentItem(value: unknown): value is CommandPaletteRecentItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isShortString(candidate.entityId) &&
    isShortString(candidate.entityType) &&
    isShortString(candidate.displayLabel) &&
    (candidate.sourceUrl === undefined || isShortString(candidate.sourceUrl))
  );
}

function isStoredShape(
  value: unknown
): value is { version: number; items: CommandPaletteRecentItem[] } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === STORAGE_VERSION &&
    Array.isArray(candidate.items) &&
    candidate.items.every(isRecentItem)
  );
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
