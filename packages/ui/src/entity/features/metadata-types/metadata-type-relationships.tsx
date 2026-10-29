/**
 * MetadataTypeRelationships - a metadata type's parent and child types.
 *
 * Read-only by default. With `actions`, each list can link another type (picked
 * with MetadataTypeField) and unlink an existing one. A child type is one whose
 * entries may sit directly below this type's entries; a parent type is the
 * reverse.
 */

import type { MetadataType } from "@loom-loyalty/sdk";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import {
  MetadataTypeField,
  metadataTypeChildrenQueryOptions,
  metadataTypeParentsQueryOptions,
} from "../../../forms/metadata-type-field/index.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { Skeleton } from "../../../primitives/skeleton.js";

export interface MetadataTypeRelationshipActions {
  /** Links `parentCode` as a parent type of this type. */
  onAddParent: (parentCode: string) => Promise<void>;
  onRemoveParent: (parent: MetadataType) => Promise<void>;
  /** Links `childCode` as a child type of this type. */
  onAddChild: (childCode: string) => Promise<void>;
  onRemoveChild: (child: MetadataType) => Promise<void>;
}

export interface MetadataTypeRelationshipsProps {
  metadataType: MetadataType;
  /** Omit for a read-only view. */
  actions?: MetadataTypeRelationshipActions;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function RelationList({
  title,
  addLabel,
  types,
  excludeCodes,
  onAdd,
  onRemove,
}: {
  title: string;
  addLabel: string;
  types: MetadataType[];
  excludeCodes: string[];
  onAdd?: (code: string) => Promise<void>;
  onRemove?: (type: MetadataType) => Promise<void>;
}): ReactNode {
  const fieldId = useId();
  const headingRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p ref={headingRef} tabIndex={-1} className="text-muted-foreground text-sm outline-none">
        {title}
      </p>
      {types.length === 0 ? (
        <p className="text-muted-foreground text-sm">None</p>
      ) : (
        <ul className="space-y-1">
          {types.map((type) => (
            <li
              key={type.metadataTypeId ?? type.code}
              className="border-border flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
            >
              <span className="text-foreground text-sm">
                {type.name} <span className="text-muted-foreground font-mono">({type.code})</span>
              </span>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 min-w-11"
                  disabled={busy}
                  aria-label={`Unlink ${type.name ?? type.code}`}
                  onClick={() =>
                    void run(async () => {
                      await onRemove(type);
                      // The focused button unmounts with its row.
                      headingRef.current?.focus();
                    }, "Could not unlink the type.")
                  }
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <div className="space-y-1">
          <Label htmlFor={fieldId} className="sr-only">
            {addLabel}
          </Label>
          <MetadataTypeField
            id={fieldId}
            value=""
            onValueChange={(code) =>
              code ? void run(() => onAdd(code), "Could not link the type.") : undefined
            }
            excludeCodes={excludeCodes}
            disabled={busy}
            placeholder={`${addLabel}...`}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function MetadataTypeRelationships({
  metadataType,
  actions,
}: MetadataTypeRelationshipsProps): ReactNode {
  // The type record doesn't carry its links, so read them from the
  // parents/children endpoints; the record's fields are a fallback.
  const code = metadataType.code ?? "";
  const parentsQuery = useQuery({ ...metadataTypeParentsQueryOptions(code), enabled: !!code });
  const childrenQuery = useQuery({ ...metadataTypeChildrenQueryOptions(code), enabled: !!code });
  const parents = parentsQuery.data ?? metadataType.parents ?? [];
  const children = childrenQuery.data ?? metadataType.children ?? [];
  const loading = !!code && (parentsQuery.isLoading || childrenQuery.isLoading);
  const loadError = parentsQuery.isError || childrenQuery.isError;
  const self = metadataType.code ? [metadataType.code] : [];
  const codes = (types: MetadataType[]) => types.map((t) => t.code ?? "").filter(Boolean);
  // A type can't be both parent and child of this one (that's a cycle). Deeper
  // cycles are rejected by the API and surface through the list's alert.
  const linked = [...self, ...codes(parents), ...codes(children)];

  return (
    <section className="space-y-4" aria-labelledby="metadata-type-relationships-heading">
      <h3
        id="metadata-type-relationships-heading"
        className="text-foreground text-sm font-semibold tracking-wide uppercase"
      >
        Relationships
      </h3>
      {loading && (
        <div role="status" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <span className="sr-only">Loading relationships</span>
        </div>
      )}
      {loadError && (
        <p role="alert" className="text-destructive text-sm">
          Couldn&apos;t load this type&apos;s relationships.
        </p>
      )}
      {!loading && (
        <>
          <RelationList
            title="Parent Types"
            addLabel="Add a parent type"
            types={parents}
            excludeCodes={linked}
            onAdd={actions?.onAddParent}
            onRemove={actions?.onRemoveParent}
          />
          <RelationList
            title="Child Types"
            addLabel="Add a child type"
            types={children}
            excludeCodes={linked}
            onAdd={actions?.onAddChild}
            onRemove={actions?.onRemoveChild}
          />
        </>
      )}
    </section>
  );
}
