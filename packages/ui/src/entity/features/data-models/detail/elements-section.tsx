import type { DataModelElement } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";
import { Badge } from "../../../../primitives/badge.js";
import { SystemElementBadge } from "../system-element-badge.js";
import { Section } from "./section.js";

export function ElementsSection({ elements }: { elements: DataModelElement[] }): ReactNode {
  return (
    <Section title={`Elements (${elements.length})`}>
      {elements.length === 0 ? (
        <p className="text-muted-foreground text-sm">No elements defined.</p>
      ) : (
        <div className="border-border overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="border-chrome-border border-b">
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Attribute
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {elements.map((el, idx) => (
                // Read-only list with no per-row state; index is a safe key.
                // inputAttribute/name can collide (e.g. two draft elements named
                // "Email" before attributes are filled in), which mis-keys rows.
                <tr
                  key={`${el.inputAttribute || el.name}-${idx}`}
                  className="border-border/60 border-t"
                >
                  <td className="text-foreground px-3 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      {el.name}
                      {el.system && <SystemElementBadge />}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {el.inputAttribute || el.outputAttribute || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {el.typeReference}
                    {el.array && <span>[]</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {el.required && (
                        <Badge
                          variant="outline"
                          role="img"
                          aria-label="Required"
                          className="text-success-dark border-success/30 text-[10px]"
                        >
                          req
                        </Badge>
                      )}
                      {el.sensitive && (
                        <Badge
                          variant="outline"
                          role="img"
                          aria-label="Sensitive data"
                          className="text-destructive border-destructive/30 text-[10px]"
                        >
                          sensitive
                        </Badge>
                      )}
                      {el.inputOnly && (
                        <Badge
                          variant="outline"
                          role="img"
                          aria-label="Input only"
                          className="text-[10px]"
                        >
                          in
                        </Badge>
                      )}
                      {el.outputOnly && (
                        <Badge
                          variant="outline"
                          role="img"
                          aria-label="Output only"
                          className="text-[10px]"
                        >
                          out
                        </Badge>
                      )}
                      {el.createOnly && (
                        <Badge
                          variant="outline"
                          role="img"
                          aria-label="Create only"
                          className="text-[10px]"
                        >
                          create
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
