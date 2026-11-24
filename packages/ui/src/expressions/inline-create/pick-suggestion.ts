/**
 * Picks the one record a picker should preselect as "Suggested" (pickers
 * brief S3, S15, S16, S17). Pure: the caller passes the candidates the API
 * returned for the current organization and the rule's context.
 *
 * A suggestion is made only when
 * - the rule (or action) is new: an existing rule opened for edit never gets one (S15);
 * - the candidate list is complete, not still loading or paged (S16);
 * - exactly one candidate fits, where "fits" means it belongs to every one of
 *   the rule's programs (S17) and passes the caller's own filter.
 *
 * A caller that already knows the right record (for example the activity the
 * sheet was opened from) passes it as `preferredId`; it is suggested when it
 * is among the candidates.
 */

export interface SuggestionCandidate {
  id: string;
  /** Programs the record belongs to. Missing or empty means program-independent. */
  programIds?: readonly string[];
}

export interface SuggestionContext<T extends SuggestionCandidate> {
  candidates: readonly T[];
  /** The rule's programs. */
  ruleProgramIds: readonly string[];
  /** True for a new rule or a newly added action. */
  isNew: boolean;
  /** True once every page of candidates has loaded. */
  listComplete: boolean;
  /** Extra fit test, for example "is a counter target". */
  fits?: (candidate: T) => boolean;
  /** A record the context already points at. */
  preferredId?: string;
}

export function fitsEveryProgram(
  candidate: SuggestionCandidate,
  ruleProgramIds: readonly string[]
): boolean {
  if (ruleProgramIds.length === 0) return false;
  const own = candidate.programIds;
  if (!own || own.length === 0) return false;
  return ruleProgramIds.every((programId) => own.includes(programId));
}

export function pickSuggestion<T extends SuggestionCandidate>(
  context: SuggestionContext<T>
): string | undefined {
  const { candidates, ruleProgramIds, isNew, listComplete, fits, preferredId } = context;
  if (!isNew || !listComplete) return undefined;

  if (preferredId) {
    const preferred = candidates.find((candidate) => candidate.id === preferredId);
    if (preferred && (!fits || fits(preferred))) return preferred.id;
  }

  const fitting = candidates.filter(
    (candidate) => fitsEveryProgram(candidate, ruleProgramIds) && (!fits || fits(candidate))
  );
  return fitting.length === 1 ? fitting[0]!.id : undefined;
}
