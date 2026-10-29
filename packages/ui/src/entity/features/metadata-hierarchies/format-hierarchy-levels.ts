/**
 * Render a hierarchy's ordered levels as "Company → Region → Store", using
 * metadata type names where known and falling back to the type code.
 */
export function formatHierarchyLevels(
  levels: readonly string[] | undefined,
  typeNames: Readonly<Record<string, string>> = {}
): string {
  if (!levels || levels.length === 0) return "";
  return levels.map((code) => typeNames[code] || code).join(" → ");
}

/**
 * Find the first level that is unselected or no longer a valid choice under
 * its parent. Returns `null` when every level is valid.
 */
export function validateHierarchyLevels(
  levels: readonly string[],
  allowedFor: (index: number) => readonly string[] | null
): string | null {
  if (levels.length === 0) return "Add at least one level.";
  for (let index = 0; index < levels.length; index += 1) {
    const code = levels[index];
    if (!code) return `Choose a metadata type for level ${index + 1}.`;
    if (levels.indexOf(code) !== index) return `Level ${index + 1} repeats an earlier type.`;
    const allowed = allowedFor(index);
    // `null` means the allowed set is still loading; don't flag it yet.
    if (allowed && !allowed.includes(code)) {
      return index === 0
        ? `Level 1 uses an unknown metadata type.`
        : `Level ${index + 1} is not a child type of level ${index}.`;
    }
  }
  return null;
}
