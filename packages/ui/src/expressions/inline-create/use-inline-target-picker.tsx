/**
 * A target picker's "+ New …" choices, compact create sheet and Suggested
 * default (pickers brief S1, S3, S5, S8, S15, S16, S17, S19; invariants I2, I4).
 *
 * Spread `pickerProps` onto `TargetField` and render `createSheet` beside it.
 * Outside an `InlineCreateProvider` it returns nothing extra.
 */

import { describeError, type DescribedError } from "@loom-loyalty/core";
import type { CreateTarget, PagedTargetDataContentItem } from "@loom-loyalty/sdk";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { TargetFormSheet } from "../../entity/features/targets/target-form-sheet.js";
import type { TargetCreatePreset } from "../../entity/features/targets/types.js";
import type { EntityCreateOption, EntityOption } from "../../forms/entity-select-box.js";
import { useTargetField } from "../../forms/target-field/use-target-field.js";
import { useInlineCreate } from "./inline-create-context";
import { pickSuggestion } from "./pick-suggestion";

/** "+ New counter" only: for actions that add to or register a counter. */
export const COUNTER_CREATE_OPTIONS: EntityCreateOption[] = [
  { key: "counter", label: "New counter" },
];

/** Counters plus limits: for the rule's Progress & limits section. */
export const COUNTER_AND_LIMIT_CREATE_OPTIONS: EntityCreateOption[] = [
  { key: "counter", label: "New counter" },
  { key: "daily-limit", label: "New limit: Daily limit" },
  { key: "weekly-limit", label: "New limit: Weekly limit" },
];

/** "+ New completion target": for actions that complete a target. */
export const COMPLETION_CREATE_OPTIONS: EntityCreateOption[] = [
  { key: "completion", label: "New completion target" },
];

/** Suggestion filter for completion targets. */
export const isCompletionTarget = (target: PagedTargetDataContentItem) =>
  String((target as { type?: unknown }).type) === "COMPLETION";

export interface CreatedTargetRef {
  code?: string;
  name?: string;
  type?: string;
}

export interface UseInlineTargetPickerOptions {
  value: string;
  /** Selects a target. `record` carries the code and type of one just created, before the list refetches. */
  onSelect: (targetId: string, record?: CreatedTargetRef) => void;
  /** Unique per picker in the sheet, for the Checks panel. */
  fieldKey: string;
  /** Defaults to COUNTER_CREATE_OPTIONS. */
  createOptions?: EntityCreateOption[];
  /** Which existing targets may be suggested. Defaults to counters. */
  fits?: (target: PagedTargetDataContentItem) => boolean;
  /** False for optional pickers that must never preselect (the rule's Progress & limits). Defaults to true. */
  suggest?: boolean;
}

export interface InlineTargetPickerProps {
  createOptions?: EntityCreateOption[];
  onCreateOption?: (key: string) => void;
  suggested: boolean;
  /** The target just created here, so the picker shows it before its list or search holds it. */
  createdOption?: EntityOption;
}

const isCounter = (target: PagedTargetDataContentItem) =>
  String((target as { type?: unknown }).type) === "COUNTER";

const PRESETS = new Set<TargetCreatePreset>([
  "counter",
  "daily-limit",
  "weekly-limit",
  "completion",
]);

export function useInlineTargetPicker({
  value,
  onSelect,
  fieldKey,
  createOptions = COUNTER_CREATE_OPTIONS,
  fits = isCounter,
  suggest = true,
}: UseInlineTargetPickerOptions): {
  pickerProps: InlineTargetPickerProps;
  createSheet: ReactNode;
} {
  const ctx = useInlineCreate();
  const wantsSuggestion = suggest && !!ctx?.isNewRule;
  const [preset, setPreset] = useState<TargetCreatePreset | null>(null);
  const {
    targets,
    isLoading,
    isLoadingAll,
    hasLoadAllError,
    hasNextPage,
    createTarget,
    isCreating,
    // The compact sheet's "More options" lists every target for X of Y and Milestone.
  } = useTargetField({ enabled: !!ctx, loadAll: wantsSuggestion || preset !== null });

  const [createError, setCreateError] = useState<DescribedError | null>(null);
  const [createdOption, setCreatedOption] = useState<EntityOption | undefined>();
  const suggestionTried = useRef(false);

  const suggestion = useMemo(() => {
    if (!ctx || !suggest) return undefined;
    return pickSuggestion({
      candidates: targets.map((t) => ({ ...t, id: String(t.targetId ?? t.code) })),
      ruleProgramIds: ctx.ruleProgramIds,
      isNew: ctx.isNewRule,
      listComplete: !isLoading && !isLoadingAll && !hasLoadAllError && !hasNextPage,
      fits,
    });
  }, [ctx, suggest, targets, isLoading, isLoadingAll, hasLoadAllError, hasNextPage, fits]);

  // Preselect once, on an empty picker. A cleared pick is never re-suggested.
  useEffect(() => {
    if (!ctx || value || suggestionTried.current || !suggestion) return;
    suggestionTried.current = true;
    const record = targets.find((t) => String(t.targetId ?? t.code) === suggestion);
    onSelect(suggestion, {
      code: record?.code,
      name: record?.name,
      type: record ? String((record as { type?: unknown }).type) : undefined,
    });
  }, [ctx, value, suggestion, targets, onSelect]);

  // The mark shows while the pick is still the suggestion; picking anything else clears it for
  // good, so picking the same record again by hand is a choice, not a suggestion.
  const [suggestionShown, setSuggestionShown] = useState(false);
  const [suggestionChanged, setSuggestionChanged] = useState(false);
  const onSuggestion = !!suggestion && value === suggestion;
  if (onSuggestion && !suggestionShown) setSuggestionShown(true);
  if (!onSuggestion && suggestionShown && !suggestionChanged) setSuggestionChanged(true);
  const suggested = onSuggestion && !suggestionChanged;
  const suggestedLabel = suggested
    ? (targets.find((t) => String(t.targetId ?? t.code) === suggestion)?.name ?? suggestion)
    : null;

  const reportSuggestion = ctx?.onSuggestionChange;
  useEffect(() => {
    if (!reportSuggestion) return;
    reportSuggestion(
      fieldKey,
      suggestedLabel && suggestion
        ? { id: suggestion, label: suggestedLabel, entityLabel: "Target" }
        : null
    );
  }, [reportSuggestion, fieldKey, suggestedLabel, suggestion]);
  // No report on unmount: the picker unmounts whenever the action editor closes, and the pick is
  // still a suggestion until saved (S5/I3). The sheet drops the line once no action names it.

  const onCreateOption = useCallback((key: string) => {
    if (!PRESETS.has(key as TargetCreatePreset)) return;
    setCreateError(null);
    setPreset(key as TargetCreatePreset);
  }, []);

  const handleSubmit = useCallback(
    async (data: CreateTarget) => {
      setCreateError(null);
      try {
        const created = (await createTarget(data)) as unknown as Record<string, unknown>;
        const id = String(created.targetId ?? created.code ?? "");
        const code = (created.code as string | undefined) ?? data.code;
        const name = (created.name as string | undefined) ?? data.name;
        setCreatedOption({ id, name: name ?? code ?? id, secondaryText: code });
        // I4: the parent draft changes only once the record exists.
        onSelect(id, {
          code,
          name,
          type: String((created.type as string | undefined) ?? data.type),
        });
        setPreset(null);
      } catch (error) {
        // S8: the error stays in the compact sheet; the draft is untouched.
        setCreateError(describeError(error, { fallback: "Couldn't create the target." }));
      }
    },
    [createTarget, onSelect]
  );

  if (!ctx) {
    return { pickerProps: { suggested: false }, createSheet: null };
  }

  return {
    pickerProps: { createOptions, onCreateOption, suggested, createdOption },
    createSheet: (
      <TargetFormSheet
        open={preset !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreset(null);
            setCreateError(null);
          }
        }}
        mode="create"
        variant="compact"
        preset={preset ?? "counter"}
        defaultProgramIds={[...ctx.ruleProgramIds]}
        defaultTimeZone={ctx.organizationTimeZone}
        allTargets={targets}
        allTargetsLoading={isLoadingAll}
        allTargetsError={hasLoadAllError}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        error={createError}
        fieldErrors={createError?.fieldErrors}
      />
    ),
  };
}
