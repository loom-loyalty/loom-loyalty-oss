import { formatDateTime, toISODateTime } from "@loom-loyalty/core";
import type { DataModel } from "@loom-loyalty/sdk";
import { Loader2, PlayCircle } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { cn } from "../../../../lib/utils.js";
import { Button } from "../../../../primitives/button.js";
import type { DataModelVersionStatus } from "../types.js";
import { Section } from "./section.js";
import { VersionStatusBadge } from "./version-status-badge.js";

export interface VersionHistorySectionProps {
  versions: DataModel[];
  currentId?: string;
  onPublishVersion?: (v: DataModel) => void;
  isPublishing?: boolean;
  /**
   * ID of the version currently being published. When provided, the row with
   * this `dataModelId` shows an in-flight spinner instead of the play icon.
   * Other rows only show disabled state. If omitted, no row-level indicator
   * is rendered even when `isPublishing` is true.
   */
  publishingVersionId?: string | null;
}

export function VersionHistorySection({
  versions,
  currentId,
  onPublishVersion,
  isPublishing,
  publishingVersionId,
}: VersionHistorySectionProps): ReactNode {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0)),
    [versions]
  );

  return (
    <Section title={`Version History (${versions.length})`}>
      <div className="border-border overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="border-chrome-border border-b">
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Version
              </th>
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Status
              </th>
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Modified
              </th>
              <th scope="col" aria-label="Actions" className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const isCurrent = v.dataModelId === currentId;
              const isDraft = v.versionStatus === "DRAFT";
              const isPublishingThisRow =
                isPublishing === true &&
                publishingVersionId != null &&
                v.dataModelId === publishingVersionId;
              return (
                <tr
                  key={v.dataModelId}
                  className={cn("border-border/60 border-t", isCurrent && "bg-primary/5")}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  <td className="text-foreground px-3 py-2 font-mono text-xs">
                    v{v.version ?? "?"}
                    {isCurrent && <span className="text-primary ml-2 text-[10px]">(current)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {v.versionStatus && (
                      <VersionStatusBadge status={v.versionStatus as DataModelVersionStatus} />
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {v.modifiedDateTime ? (
                      <time dateTime={toISODateTime(new Date(v.modifiedDateTime)) ?? ""}>
                        {formatDateTime(v.modifiedDateTime) ?? "—"}
                      </time>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isDraft && onPublishVersion && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onPublishVersion(v)}
                        disabled={isPublishing}
                        aria-label={
                          isPublishingThisRow
                            ? `Publishing v${v.version ?? "?"}`
                            : `Publish v${v.version ?? "?"}`
                        }
                        aria-busy={isPublishingThisRow}
                        className="text-success-dark hover:text-success-dark h-11"
                      >
                        {isPublishingThisRow ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <PlayCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {isPublishingThisRow ? "Publishing..." : "Publish"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
