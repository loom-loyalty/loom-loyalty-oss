/**
 * Target Detail Sheet Content
 *
 * Displays all Target fields with type-specific sections.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CompletionTarget,
  CounterTarget,
  MilestoneTarget,
  MilestoneTargetItem,
  ResponseTargetData,
  XOfYTarget,
} from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useProgramField } from "../../../forms/program-field/index.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { TARGET_SCOPE_LABELS, TARGET_TYPE_LABELS } from "./types.js";

export interface TargetDetailProps {
  target: ResponseTargetData;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  schema?: UIEntitySchema;
  extendedFields?: string[];
  /** All targets for sub-target name resolution (milestone/xofy) */
  allTargets?: ResponseTargetData[];
}

/**
 * Target detail content for Sheet display
 */
export function TargetDetail({
  target,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
  allTargets = [],
}: TargetDetailProps): ReactNode {
  const description = extractLocalizedString(target.description);
  const type = (target as unknown as { type: string }).type;
  const scope = (target as unknown as { scope: string }).scope;

  // Fetch programs to resolve IDs to names
  const { options: programOptions } = useProgramField();

  // Build lookup map for sub-target resolution
  const targetLookup = useMemo(() => {
    const map = new Map<string, ResponseTargetData>();
    for (const t of allTargets) {
      if (t.targetId) {
        map.set(t.targetId, t);
      }
    }
    return map;
  }, [allTargets]);

  // Resolve program IDs to display names
  const resolvedPrograms = useMemo(() => {
    if (!target.programIds || target.programIds.length === 0) return [];
    return target.programIds.map((id) => {
      const program = programOptions.find((p) => p.id === id);
      return { id, name: program?.name ?? id };
    });
  }, [target.programIds, programOptions]);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={target.name} />
          <DetailRow label="Code" value={target.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            <Badge variant="secondary" className="mt-1 font-normal">
              {TARGET_TYPE_LABELS[type] ?? type}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Scope</p>
            <Badge variant="outline" className="mt-1 font-normal">
              {TARGET_SCOPE_LABELS[scope] ?? scope}
            </Badge>
          </div>
        </div>
      </section>

      {/* Type-Specific Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          {TARGET_TYPE_LABELS[type] ?? type} Configuration
        </h3>
        {type === "COMPLETION" && <CompletionSection target={target as CompletionTarget} />}
        {type === "COUNTER" && <CounterSection target={target as CounterTarget} />}
        {type === "MILESTONE" && (
          <MilestoneSection target={target as MilestoneTarget} targetLookup={targetLookup} />
        )}
        {type === "X_OF_Y" && (
          <XOfYSection target={target as XOfYTarget} targetLookup={targetLookup} />
        )}
      </section>

      {/* Programs */}
      {resolvedPrograms.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h3>
          <div className="flex flex-wrap gap-2">
            {resolvedPrograms.map((program) => (
              <Badge key={program.id} variant="outline">
                {program.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Environments */}
      {target.enabledInEnvironments && target.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={target.enabledInEnvironments} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(target.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(target.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* ID */}
      {target.targetId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Target ID" value={target.targetId} mono />
        </section>
      )}

      {/* Extended Fields */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={target}
          mode="view"
          title="Additional Information"
          defaultCollapsed={false}
        />
      )}

      {/* Action Buttons */}
      {(canEdit || canDelete) && (
        <div className="border-border flex gap-2 border-t pt-4">
          {canDelete && onDelete && (
            <Button variant="outline" className="flex-1" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Type-Specific Sections
// ============================================================

function CompletionSection({ target }: { target: CompletionTarget }): ReactNode {
  return (
    <div className="space-y-3">
      <DetailRow label="Completion Type" value={target.completionTargetType?.name ?? "\u2014"} />
    </div>
  );
}

function CounterSection({ target }: { target: CounterTarget }): ReactNode {
  return (
    <div className="space-y-3">
      <DetailRow label="Counter Type" value={target.counterTargetType?.name ?? "\u2014"} />
      {target.targetValue != null && (
        <DetailRow label="Target Value" value={String(target.targetValue)} />
      )}
      {target.cappingTarget && (
        <div>
          <p className="text-muted-foreground text-sm">Capping Target</p>
          <Badge variant="outline" className="mt-1 font-normal">
            Yes
          </Badge>
        </div>
      )}
      {target.numberOfCycles != null && target.numberOfCycles > 0 && (
        <>
          <DetailRow label="Number of Cycles" value={String(target.numberOfCycles)} />
          {target.numberOfCyclesToAchieve != null && (
            <DetailRow label="Cycles to Achieve" value={String(target.numberOfCyclesToAchieve)} />
          )}
          {target.cyclesMustBeConsecutive && (
            <div>
              <p className="text-muted-foreground text-sm">Consecutive Cycles</p>
              <Badge variant="outline" className="mt-1 font-normal">
                Required
              </Badge>
            </div>
          )}
          {target.carryOverToNextCycle && (
            <div>
              <p className="text-muted-foreground text-sm">Carry Over</p>
              <Badge variant="outline" className="mt-1 font-normal">
                Enabled
              </Badge>
            </div>
          )}
        </>
      )}
      {target.growthTargetOperator && (
        <>
          <DetailRow label="Growth Operator" value={target.growthTargetOperator} />
          {target.growthTargetOperand != null && (
            <DetailRow label="Growth Operand" value={String(target.growthTargetOperand)} />
          )}
          {target.growthTargetAlgorithm && (
            <DetailRow label="Growth Algorithm" value={target.growthTargetAlgorithm} />
          )}
        </>
      )}
    </div>
  );
}

function MilestoneSection({
  target,
  targetLookup,
}: {
  target: MilestoneTarget;
  targetLookup: Map<string, ResponseTargetData>;
}): ReactNode {
  const items = (target.items as MilestoneTargetItem[] | undefined) ?? [];
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <DetailRow label="Milestone Type" value={target.milestoneTargetType?.name ?? "\u2014"} />
      {sortedItems.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">Steps ({sortedItems.length})</p>
          <ol className="space-y-2">
            {sortedItems.map((item, index) => {
              const resolved = targetLookup.get(item.targetId);
              const resolvedType = resolved
                ? (resolved as unknown as { type: string }).type
                : undefined;
              return (
                <li
                  key={item.targetId}
                  className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground text-sm font-medium">
                      {resolved?.name ?? item.targetId}
                    </p>
                  </div>
                  {resolvedType && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {TARGET_TYPE_LABELS[resolvedType] ?? resolvedType}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function XOfYSection({
  target,
  targetLookup,
}: {
  target: XOfYTarget;
  targetLookup: Map<string, ResponseTargetData>;
}): ReactNode {
  const items = (target.items as string[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <DetailRow label="X of Y Type" value={target.xofYTargetType?.name ?? "\u2014"} />
      <DetailRow
        label="Requirement"
        value={`Complete ${target.targetValue ?? 0} of ${items.length}`}
      />
      {items.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">Available Targets ({items.length})</p>
          <ul className="space-y-2">
            {items.map((itemId) => {
              const resolved = targetLookup.get(itemId);
              const resolvedType = resolved
                ? (resolved as unknown as { type: string }).type
                : undefined;
              return (
                <li
                  key={itemId}
                  className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <p className="text-foreground text-sm font-medium">
                      {resolved?.name ?? itemId}
                    </p>
                  </div>
                  {resolvedType && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {TARGET_TYPE_LABELS[resolvedType] ?? resolvedType}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared Components
// ============================================================

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps): ReactNode {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}
