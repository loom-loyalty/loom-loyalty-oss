/**
 * Expression Modal
 *
 * Roomy Dialog shell (KTD5) that hosts the shared expression stack — AI bar,
 * recursive builder, live preview, validation, and migration notice — behind a
 * local draft with Save/Cancel semantics (R1-R3). One shared component
 * configured by props for both the WHEN and WHAT event-rule wizard steps
 * (KTD9); the sentence-mode leaf rendering and property picker land in later
 * units (U2/U3) — this shell hosts `ExpressionBuilder` with
 * `presentation="sentence"` already threaded (R6a).
 *
 * AI state contract (KTD11): `@loom-loyalty/ui` cannot import a hub hook
 * (package isolation — this package is intended for open-source reuse and must
 * not depend on `apps/hub`), so the caller's AI "step" state machine (e.g.
 * `useExpressionAiStep`) is injected via `aiBar.useAiStep`, a function called
 * unconditionally on every render (a "hook passed as a prop" bridge) with
 * `applyToDraft` bound to this modal's local draft-setter. `applyToDraft` is
 * itself gated by an open-epoch check so a Generate/Fix that resolves after the
 * modal has closed can never repopulate a discarded draft — required because,
 * like its `condition-expression-sheet.tsx` precedent, this modal does not
 * unmount on close.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../lib/utils.js";
import { Button } from "../primitives/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog.js";
import { Skeleton } from "../primitives/skeleton.js";

import { ExpressionAiBuilder } from "./expression-ai-builder.js";
import { ExpressionBuilder } from "./expression-builder.js";
import { ExpressionMigrationNotice } from "./expression-migration-notice.js";
import { ExpressionSummary } from "./expression-summary.js";
import { ExpressionTemplatePicker } from "./expression-template-picker.js";
import { ExpressionValidation } from "./expression-validation.js";
import { normalizeExpression } from "./migrate.js";
import type {
  Expression,
  ExpressionModalAiBridge,
  ExpressionModalAiStepApi,
  ExpressionModalProps,
} from "./types.js";
import { validateExpressionTree } from "./utils.js";

// -- Path-validation aggregation point (U3 wires the real picker into this) --

interface ExpressionPathValidationApi {
  /**
   * Registers whether a field (keyed by a stable id, e.g. the node path) is
   * currently showing an unresolved-path error. `ExpressionModal` aggregates
   * these into its `canSave` gate alongside `validateExpressionTree` (fix #11).
   * A picker that can't resolve because the SCHEMA is unavailable (rather than
   * the path being genuinely wrong) must not call this with `true` — that
   * non-blocking state must never gate Save.
   */
  reportPathError: (id: string, hasError: boolean) => void;
  /** Reports a schema-resolved field name for a path in the live preview. */
  reportFieldName: (id: string, path: string, resolvedName: string | undefined) => void;
}

const NOOP_PATH_VALIDATION: ExpressionPathValidationApi = {
  reportPathError: () => {},
  reportFieldName: () => {},
};

/** The AI step used when the modal has no AI bar: builder edits go straight to the draft. */
function useNoAiStep(bridge: ExpressionModalAiBridge): ExpressionModalAiStepApi {
  return {
    aiProposal: null,
    aiAnnouncement: null,
    aiDrafted: false,
    isLoading: false,
    fixLoading: false,
    error: null,
    fixError: null,
    limit: null,
    fixLimit: null,
    generate: () => {},
    fix: () => {},
    onBuilderChange: bridge.applyToDraft,
  };
}

const ExpressionPathValidationContext = createContext<ExpressionPathValidationApi | null>(null);

/**
 * Consumed by the (future) property picker to report per-field unresolved-path
 * state up to the enclosing `ExpressionModal`. Outside a modal this is a no-op,
 * so non-modal `card`-presentation consumers are unaffected.
 */
export function useExpressionPathValidation(): ExpressionPathValidationApi {
  return useContext(ExpressionPathValidationContext) ?? NOOP_PATH_VALIDATION;
}

export function ExpressionModal({
  open,
  onOpenChange,
  initialExpression,
  rawInitialExpression,
  onSave,
  disabled,
  mode,
  dataModelCode,
  eventTypeCode,
  fetchDataModel,
  isResolvingSchema,
  showActions,
  aiBar,
  header,
  saveLabel,
  className,
  bodyExtra,
  onDraftChange,
  templates,
  renderConditionAside,
}: ExpressionModalProps): ReactNode {
  // The working copy edits the NORMALIZED tree; the migration notice inspects
  // the RAW `rawInitialExpression` (normalize deletes some corrupt fields
  // before they can be surfaced) — mirrors `condition-expression-sheet.tsx`.
  const normalizedInitial = useMemo(
    () => (initialExpression ? normalizeExpression(initialExpression) : null),
    [initialExpression]
  );

  const [draft, setDraft] = useState<Expression | null>(() => normalizedInitial);

  useEffect(() => {
    onDraftChange?.(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDraftChange is a caller-supplied callback, not draft-derived state; re-running only on identity change (not draft) would miss draft updates, so draft is the sole trigger.
  }, [draft]);

  // Bumped on every close (Save, Cancel, Esc, overlay dismiss) so a Generate/Fix
  // still in flight from the just-closed session can never write into a fresh
  // draft — the modal does NOT unmount on close (KTD11), so this can't rely on
  // remount-to-reset like a keyed component would.
  const [epoch, setEpoch] = useState(0);
  const liveEpochRef = useRef(epoch);
  liveEpochRef.current = epoch;

  const pathErrorsRef = useRef<Map<string, boolean>>(new Map());
  const fieldNamesRef = useRef<Map<string, { path: string; name: string }>>(new Map());
  const [pathErrorCount, setPathErrorCount] = useState(0);
  const [, setFieldNamesVersion] = useState(0);

  // Adjust state during render on an open/closed transition (React's documented
  // pattern for "storing information from previous renders") rather than an
  // effect, which would cascade an extra render. Opening (including reopening
  // right after a Save) resyncs the draft to the latest committed value;
  // closing does the same AND invalidates in-flight AI writes.
  const [prevOpen, setPrevOpen] = useState(open);
  // The epoch guard above only stops a late AI write from reaching `draft` —
  // `aiStep.aiProposal`/`aiAnnouncement`/`error`/`fixError` are read straight
  // from the caller's AI-step hook, which keeps running (unmounted or not)
  // across a close/reopen since the modal itself never unmounts (KTD11). A
  // Generate that resolves after close, or a proposal left over from a
  // cancelled session, would otherwise resurface in the reopened AI bar even
  // though the draft it belonged to was discarded (adversarial review
  // finding). Suppress rendering those fields for any session until the user
  // starts a fresh Generate/Fix in it.
  const [aiSessionSuppressed, setAiSessionSuppressed] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setDraft(normalizedInitial);
    pathErrorsRef.current = new Map();
    fieldNamesRef.current = new Map();
    setPathErrorCount(0);
    setFieldNamesVersion((version) => version + 1);
    setAiSessionSuppressed(true);
    if (!open) {
      setEpoch((e) => e + 1);
    }
  }

  const reportPathError = useCallback((id: string, hasError: boolean) => {
    const map = pathErrorsRef.current;
    const had = map.has(id);
    if (hasError === had) return;
    if (hasError) {
      map.set(id, true);
    } else {
      map.delete(id);
    }
    setPathErrorCount(map.size);
  }, []);
  const reportFieldName = useCallback(
    (id: string, path: string, resolvedName: string | undefined) => {
      const map = fieldNamesRef.current;
      const current = map.get(id);
      if (!resolvedName) {
        if (current) {
          map.delete(id);
          setFieldNamesVersion((version) => version + 1);
        }
        return;
      }
      if (current?.path === path && current.name === resolvedName) return;
      map.set(id, { path, name: resolvedName });
      setFieldNamesVersion((version) => version + 1);
    },
    []
  );
  const resolveFieldName = useCallback((path: string) => {
    for (const { path: resolvedPath, name } of fieldNamesRef.current.values()) {
      if (resolvedPath === path) return name;
    }
    return undefined;
  }, []);
  const pathValidationValue = useMemo(
    () => ({ reportPathError, reportFieldName }),
    [reportPathError, reportFieldName]
  );

  // The sole write path into the draft — used for manual builder edits AND
  // handed to the caller's AI-step hook as `applyToDraft`. Captures `epoch` at
  // creation time (via the dependency array) so a stale closure bound into an
  // in-flight AI request compares against the LIVE epoch at write-time and is
  // dropped if the modal has since closed.
  const applyToDraft = useCallback(
    (expr: Expression | null) => {
      if (epoch !== liveEpochRef.current) return;
      setDraft(expr);
    },
    [epoch]
  );

  const aiBridge = useMemo(
    () => ({ currentExpression: draft, applyToDraft }),
    [draft, applyToDraft]
  );
  // Called unconditionally every render — a "hook passed as a prop" bridge.
  // The caller instantiates its own AI-step hook (e.g. `useExpressionAiStep`)
  // inside this function, bound to `aiBridge` (KTD11).
  // Whether a caller passes `aiBar` is fixed for a modal's life, so the hook order is stable.
  const useAiStep = aiBar?.useAiStep ?? useNoAiStep;
  const aiStep = useAiStep(aiBridge);

  const canFix = aiBar?.isFlatReward ? aiBar.isFlatReward(draft) : draft !== null;

  const treeErrors = useMemo(() => (draft ? validateExpressionTree(draft) : []), [draft]);
  const hasBlockingTreeErrors = treeErrors.some((e) => e.severity === "error");
  const canSave = !disabled && draft !== null && !hasBlockingTreeErrors && pathErrorCount === 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave(draft);
    onOpenChange(false);
  }, [canSave, draft, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl",
          className
        )}
      >
        {/* Three tiers from solid tokens: a white title area, an olive-sage
            (--surface) working well where the AI bar and condition rows sit as
            white cards, and a white footer holding the preview + actions. */}
        <DialogHeader className="border-border border-b px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="font-serif text-2xl leading-tight">
              {header.heading}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary-dark rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase">
                {header.eyebrow}
              </span>
              {!!header.entity && (
                <>
                  <span className="text-muted-foreground" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-muted-foreground text-sm">{header.entity}</span>
                </>
              )}
            </div>
          </div>
          {/* Radix requires a description for the dialog's accessible name chain;
              fall back to a visually-hidden one when the caller gives no subtitle. */}
          <DialogDescription className={cn(header.subtitle ? undefined : "sr-only")}>
            {header.subtitle ?? "Build the condition, then Save to apply it or Cancel to discard."}
          </DialogDescription>
        </DialogHeader>

        <ExpressionPathValidationContext.Provider value={pathValidationValue}>
          <div className="bg-surface flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
            {/* AI bar pinned at the top (R2) */}
            {aiBar && (
              <ExpressionAiBuilder
                surface={aiBar.surface}
                label={aiBar.label}
                placeholder={aiBar.placeholder}
                onGenerate={(prompt) => {
                  setAiSessionSuppressed(false);
                  aiStep.generate(prompt);
                }}
                onFix={(prompt) => {
                  setAiSessionSuppressed(false);
                  aiStep.fix(prompt);
                }}
                canFix={canFix}
                isLoading={aiStep.isLoading || aiStep.fixLoading}
                isResolvingSchema={!!isResolvingSchema || !!aiBar.aiLoadingGate}
                error={aiSessionSuppressed ? null : (aiStep.error ?? aiStep.fixError)}
                limit={
                  // The limit that goes with the error shown, so a stale one can't hide a newer error.
                  aiSessionSuppressed
                    ? null
                    : aiStep.error
                      ? (aiStep.limit ?? null)
                      : aiStep.fixError
                        ? (aiStep.fixLimit ?? null)
                        : null
                }
                assumptions={aiSessionSuppressed ? [] : (aiStep.aiProposal?.assumptions ?? [])}
                explanation={aiSessionSuppressed ? null : (aiStep.aiProposal?.explanation ?? null)}
                clarifyingQuestion={
                  aiSessionSuppressed ? null : (aiStep.aiProposal?.clarifyingQuestion ?? null)
                }
                generatedAnnouncement={aiSessionSuppressed ? null : aiStep.aiAnnouncement}
              />
            )}

            {/* Scrollable builder body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
              <ExpressionMigrationNotice expression={rawInitialExpression ?? initialExpression} />

              {draft === null && !!templates?.length && (
                <ExpressionTemplatePicker
                  templates={templates}
                  onSelect={(expr) => aiStep.onBuilderChange(normalizeExpression(expr))}
                  disabled={disabled}
                />
              )}

              {isResolvingSchema ? (
                <div className="space-y-2" role="status" aria-label="Loading condition fields">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-5/6" />
                  <Skeleton className="h-10 w-2/3" />
                </div>
              ) : (
                <ExpressionBuilder
                  expression={draft}
                  onChange={aiStep.onBuilderChange}
                  disabled={disabled}
                  showActions={showActions}
                  mode={mode}
                  dataModelCode={dataModelCode}
                  eventTypeCode={eventTypeCode}
                  fetchDataModel={fetchDataModel}
                  isResolvingSchema={isResolvingSchema}
                  presentation="sentence"
                  renderConditionAside={renderConditionAside}
                  label=""
                  helperText=""
                />
              )}

              <ExpressionValidation expression={draft} />

              {bodyExtra}
            </div>
          </div>
        </ExpressionPathValidationContext.Provider>

        {/* Always-visible preview + actions */}
        <div className="border-border bg-card space-y-3 border-t px-6 py-4">
          <ExpressionSummary
            expression={draft as Record<string, unknown> | null}
            label="Preview"
            friendly
            resolveFieldName={resolveFieldName}
            isValid={draft !== null && !hasBlockingTreeErrors && pathErrorCount === 0}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="min-h-11 sm:min-h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary-gradient"
              onClick={handleSave}
              disabled={!canSave}
              className="min-h-11 sm:min-h-9"
            >
              {saveLabel ?? "Save condition"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
