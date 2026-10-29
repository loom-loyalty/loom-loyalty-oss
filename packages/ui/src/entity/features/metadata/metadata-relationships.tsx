/**
 * MetadataRelationships - a metadata entry's parents and children.
 *
 * The entry's type decides the shape: one parent slot per parent type (an entry
 * has at most one parent of each type, so choosing another one moves it), and
 * one child list per child type. Read-only without `actions`.
 */

import {
  getMetadataManagementListMetadataChildrenQueryKey,
  getMetadataManagementListMetadataParentsQueryKey,
  metadataManagementListMetadataChildren,
  metadataManagementListMetadataParents,
  type MetadataType,
} from "@loom-loyalty/sdk";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { MetadataField } from "../../../forms/metadata-field/index.js";
import {
  metadataTypeChildrenQueryOptions,
  metadataTypeParentsQueryOptions,
} from "../../../forms/metadata-type-field/index.js";
import { useAllPages } from "../../../hooks/use-all-pages.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { Skeleton } from "../../../primitives/skeleton.js";

/** The fields of a metadata entry this view reads (any metadata category). */
export interface MetadataLinkEntry {
  metadataId?: string;
  code?: string;
  name?: string;
  typeCode?: string;
}

export interface MetadataRelationshipActions {
  /** Places the entry under `parentCode` of `parentTypeCode`, replacing its parent of that type. */
  onSetParent: (parentTypeCode: string, parentCode: string) => Promise<void>;
  onRemoveParent: (parent: MetadataLinkEntry) => Promise<void>;
  /** Places an existing entry of `childTypeCode` under this entry. */
  onAddChild: (childTypeCode: string, childCode: string) => Promise<void>;
  onRemoveChild: (child: MetadataLinkEntry) => Promise<void>;
}

export interface MetadataRelationshipsProps {
  metadata: MetadataLinkEntry;
  actions?: MetadataRelationshipActions;
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function entryLabel(entry: MetadataLinkEntry): string {
  return entry.name || entry.code || "Unnamed";
}

function ErrorText({ error }: { error: string | null }): ReactNode {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

function ParentSlot({
  parentType,
  current,
  actions,
}: {
  parentType: MetadataType;
  current: MetadataLinkEntry | undefined;
  actions?: MetadataRelationshipActions;
}): ReactNode {
  const fieldId = useId();
  const { busy, error, run } = useRun();
  const typeCode = parentType.code ?? "";
  const typeName = parentType.name || typeCode;

  return (
    <li className="space-y-1">
      <Label htmlFor={fieldId} className="text-sm">
        {typeName}
      </Label>
      {actions ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <MetadataField
              id={fieldId}
              typeCode={typeCode}
              typeLabel={typeName}
              value={current?.code ?? ""}
              showCreateNew={false}
              disabled={busy}
              placeholder={`No ${typeName}`}
              onValueChange={(code) =>
                code && code !== current?.code
                  ? void run(() => actions.onSetParent(typeCode, code), "Could not set the parent.")
                  : undefined
              }
            />
          </div>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11"
              disabled={busy}
              aria-label={`Remove from ${entryLabel(current)}`}
              onClick={() =>
                void run(() => actions.onRemoveParent(current), "Could not remove the parent.")
              }
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : (
        <p id={fieldId} className="text-foreground text-sm">
          {current ? entryLabel(current) : "None"}
        </p>
      )}
      <ErrorText error={error} />
    </li>
  );
}

function ChildList({
  childType,
  entries,
  actions,
}: {
  childType: MetadataType;
  entries: MetadataLinkEntry[];
  actions?: MetadataRelationshipActions;
}): ReactNode {
  const fieldId = useId();
  const headingRef = useRef<HTMLParagraphElement>(null);
  const { busy, error, run } = useRun();
  const typeCode = childType.code ?? "";
  const typeName = childType.name || typeCode;

  return (
    <li className="space-y-2">
      <p ref={headingRef} tabIndex={-1} className="text-muted-foreground text-sm outline-none">
        {typeName}
      </p>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">None</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((child) => (
            <li
              key={child.metadataId ?? child.code}
              className="border-border flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
            >
              <span className="text-foreground text-sm">
                {entryLabel(child)}{" "}
                <span className="text-muted-foreground font-mono">({child.code})</span>
              </span>
              {actions && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 min-w-11"
                  disabled={busy}
                  aria-label={`Remove ${entryLabel(child)}`}
                  onClick={() =>
                    void run(async () => {
                      await actions.onRemoveChild(child);
                      // The focused button unmounts with its row.
                      headingRef.current?.focus();
                    }, "Could not remove the child.")
                  }
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {actions && (
        <div className="space-y-1">
          <Label htmlFor={fieldId} className="sr-only">
            Add a {typeName}
          </Label>
          <MetadataField
            id={fieldId}
            typeCode={typeCode}
            typeLabel={typeName}
            value=""
            showCreateNew={false}
            disabled={busy}
            placeholder={`Add a ${typeName}...`}
            onValueChange={(code) =>
              code
                ? void run(() => actions.onAddChild(typeCode, code), "Could not add the child.")
                : undefined
            }
          />
          <p className="text-muted-foreground text-xs">
            A {typeName} that already has a parent of this type moves here.
          </p>
        </div>
      )}
      <ErrorText error={error} />
    </li>
  );
}

export function MetadataRelationships({
  metadata,
  actions,
}: MetadataRelationshipsProps): ReactNode {
  const id = metadata.metadataId ?? "";
  const typeCode = metadata.typeCode ?? "";

  const parentTypes = useQuery({
    ...metadataTypeParentsQueryOptions(typeCode),
    enabled: !!typeCode,
  });
  const childTypes = useQuery({
    ...metadataTypeChildrenQueryOptions(typeCode),
    enabled: !!typeCode,
  });
  // Every page of the entry's links, so a parent or child past the first page
  // still shows; a failed page reads as an error, never as a short list.
  const parents = useAllPages<MetadataLinkEntry>({
    queryKey: getMetadataManagementListMetadataParentsQueryKey(id),
    fetchPage: (page, size) => metadataManagementListMetadataParents(id, { page, size }),
    enabled: !!id,
    source: "metadata-parents",
  });
  const children = useAllPages<MetadataLinkEntry>({
    queryKey: getMetadataManagementListMetadataChildrenQueryKey(id),
    fetchPage: (page, size) => metadataManagementListMetadataChildren(id, { page, size }),
    enabled: !!id,
    source: "metadata-children",
  });

  const queries = [parentTypes, childTypes, parents, children];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);
  const parentTypeList = parentTypes.data ?? [];
  const childTypeList = childTypes.data ?? [];

  return (
    <section className="space-y-4" aria-labelledby="metadata-relationships-heading">
      <h3
        id="metadata-relationships-heading"
        className="text-foreground text-sm font-semibold tracking-wide uppercase"
      >
        Relationships
      </h3>
      {loading ? (
        <div role="status" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <span className="sr-only">Loading relationships</span>
        </div>
      ) : failed ? (
        <p role="alert" className="text-destructive text-sm">
          Couldn&apos;t load this entry&apos;s relationships.
        </p>
      ) : parentTypeList.length === 0 && childTypeList.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This metadata type has no parent or child types. Link types on the Metadata Types page
          first.
        </p>
      ) : (
        <>
          {parentTypeList.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Parents</p>
              <ul className="space-y-3">
                {parentTypeList.map((type) => (
                  <ParentSlot
                    key={type.code}
                    parentType={type}
                    current={parents.items.find((p) => p.typeCode === type.code)}
                    actions={actions}
                  />
                ))}
              </ul>
            </div>
          )}
          {childTypeList.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Children</p>
              <ul className="space-y-4">
                {childTypeList.map((type) => (
                  <ChildList
                    key={type.code}
                    childType={type}
                    entries={children.items.filter((c) => c.typeCode === type.code)}
                    actions={actions}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
