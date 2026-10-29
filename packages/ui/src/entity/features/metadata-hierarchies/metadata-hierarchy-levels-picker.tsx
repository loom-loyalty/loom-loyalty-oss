/**
 * MetadataHierarchyLevelsPicker - ordered level selection for a hierarchy view.
 *
 * The first level may be any metadata type; every following level offers the
 * child types of the level above it, so each adjacent pair is a valid
 * parent → child type link. Levels are added and removed from the bottom.
 *
 * When the caller passes `onCreateType` / `onLinkChildType`, a level can also
 * get a brand-new type (created and linked under the level above) or an
 * existing type that is not linked there yet (linked on selection).
 */

import type { CreateMetadataType, UpdateMetadataType } from "@loom-loyalty/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Minus, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  MetadataTypeField,
  metadataTypeChildrenQueryKey,
} from "../../../forms/metadata-type-field/index.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { MetadataTypeFormSheet } from "../metadata-types/metadata-type-form-sheet.js";
import type { MetadataHierarchyLevelsPickerProps } from "./types.js";

interface LevelFieldProps {
  index: number;
  value: string;
  parentCode: string | null;
  /** Codes chosen on the other levels; a type appears once per hierarchy. */
  otherCodes: string[];
  onChange: (value: string) => void;
  onCreateType?: MetadataHierarchyLevelsPickerProps["onCreateType"];
  onLinkChildType?: MetadataHierarchyLevelsPickerProps["onLinkChildType"];
  disabled?: boolean;
}

function LevelField({
  index,
  value,
  parentCode,
  otherCodes,
  onChange,
  onCreateType,
  onLinkChildType,
  disabled,
}: LevelFieldProps): ReactNode {
  const id = `metadata-hierarchy-level-${index}`;
  const hintId = `${id}-hint`;
  const [linkMode, setLinkMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const canLink = !!parentCode && !!onLinkChildType;

  // A new link changes what the level above allows; refresh it so this level's
  // options and the sheet's "is a child type" check see the new type at once.
  const refreshParent = () =>
    parentCode
      ? queryClient.invalidateQueries({ queryKey: metadataTypeChildrenQueryKey(parentCode) })
      : Promise.resolve();
  const exclude = parentCode ? [...otherCodes, parentCode] : otherCodes;

  const pickUnlinked = async (code: string) => {
    if (!parentCode || !onLinkChildType || !code) return;
    setBusy(true);
    setError(null);
    try {
      await onLinkChildType(parentCode, code);
      await refreshParent();
      onChange(code);
      setLinkMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link that type.");
    } finally {
      setBusy(false);
    }
  };

  const renderCreateSheet = onCreateType
    ? (open: boolean, onOpenChange: (open: boolean) => void) => (
        <MetadataTypeFormSheet
          open={open}
          onOpenChange={(next) => {
            if (!next) setCreateError(null);
            onOpenChange(next);
          }}
          mode="create"
          isSubmitting={busy}
          error={createError}
          onSubmit={async (data: CreateMetadataType | UpdateMetadataType) => {
            setBusy(true);
            setCreateError(null);
            try {
              const code = await onCreateType(data as CreateMetadataType, parentCode);
              await refreshParent();
              onChange(code);
              onOpenChange(false);
            } catch (err) {
              setCreateError(
                err instanceof Error ? err.message : "Could not create the metadata type."
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )
    : undefined;

  const hint =
    index === 0
      ? "Top level. Any metadata type."
      : linkMode
        ? `Choosing a type links it as a child type of ${parentCode}.`
        : `Child types of ${parentCode}.`;

  return (
    <li className="space-y-1">
      <Label htmlFor={id} className="text-sm">
        Level {index + 1}
      </Label>
      <MetadataTypeField
        id={id}
        value={value}
        onValueChange={(code) => (linkMode ? void pickUnlinked(code) : onChange(code))}
        childOf={linkMode ? undefined : (parentCode ?? undefined)}
        excludeCodes={exclude}
        renderCreateSheet={renderCreateSheet}
        disabled={disabled || busy}
        aria-describedby={hintId}
        placeholder={linkMode ? "Select any metadata type..." : "Select metadata type..."}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
        {canLink && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={disabled || busy}
            onClick={() => {
              setError(null);
              setLinkMode((mode) => !mode);
            }}
          >
            {linkMode ? (
              <>
                <X className="h-4 w-4" aria-hidden="true" />
                Only linked types
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Use a type not linked under {parentCode}
              </>
            )}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

export function MetadataHierarchyLevelsPicker({
  levels,
  onLevelsChange,
  onCreateType,
  onLinkChildType,
  disabled,
}: MetadataHierarchyLevelsPickerProps): ReactNode {
  const lastLevel = levels[levels.length - 1] ?? "";
  const canAdd = !disabled && !!lastLevel;

  const setLevel = (index: number, value: string) => {
    // Changing a level invalidates every level below it.
    onLevelsChange([...levels.slice(0, index), value]);
  };

  return (
    <fieldset className="space-y-3" aria-describedby="metadata-hierarchy-levels-hint">
      <legend className="text-sm font-medium">
        Levels <span className="text-destructive">*</span>
      </legend>
      <p id="metadata-hierarchy-levels-hint" className="text-muted-foreground text-xs">
        Ordered top to bottom. Each level must be a child type of the level above.
      </p>
      <ol className="space-y-3">
        {levels.map((code, index) => (
          <LevelField
            key={index}
            index={index}
            value={code}
            parentCode={index === 0 ? null : levels[index - 1] || null}
            otherCodes={levels.filter((c, i) => i !== index && c)}
            onChange={(value) => setLevel(index, value)}
            onCreateType={onCreateType}
            onLinkChildType={onLinkChildType}
            disabled={disabled || (index > 0 && !levels[index - 1])}
          />
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={!canAdd}
          onClick={() => onLevelsChange([...levels, ""])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add level
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={disabled || levels.length <= 1}
          onClick={() => onLevelsChange(levels.slice(0, -1))}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
          Remove last level
        </Button>
      </div>
    </fieldset>
  );
}
