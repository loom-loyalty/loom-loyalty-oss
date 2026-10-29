import { z } from "zod";

import { Badge } from "../../../primitives/badge";
import {
  CardContent,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { defineOpenUIComponent } from "../../types";

const statusVariantMap = {
  draft: "secondary" as const,
  ready: "info" as const,
  complete: "success" as const,
};

const statusLabelMap = {
  draft: "Draft",
  ready: "Ready",
  complete: "Complete",
};

export const SetupSummary = defineOpenUIComponent({
  name: "SetupSummary",
  props: z.object({
    title: z.string(),
    sections: z.array(
      z.object({
        label: z.string(),
        items: z.array(z.string()),
      })
    ),
    status: z.enum(["draft", "ready", "complete"]).optional(),
  }),
  description:
    "A read-only summary card displaying configuration sections and their items. Includes a status badge (draft, ready, complete). Used at the end of setup wizards.",
  component: ({ props }) => {
    const sections = props.sections ?? [];
    const status = props.status ?? "draft";

    return (
      <CardPrimitive>
        <CardHeader>
          <CardTitle>{props.title ?? "Setup Summary"}</CardTitle>
          <Badge
            variant={statusVariantMap[status]}
            role="status"
            aria-label={`Status: ${statusLabelMap[status]}`}
          >
            {statusLabelMap[status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div key={index}>
                <h4 className="text-foreground text-sm font-medium">{section.label}</h4>
                <ul className="mt-1 space-y-1" role="list">
                  {(section.items ?? []).map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="text-muted-foreground flex items-center gap-2 text-sm"
                    >
                      <span
                        className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {sections.length === 0 && (
              <p className="text-muted-foreground py-2 text-center text-sm" role="status">
                No configuration data
              </p>
            )}
          </div>
        </CardContent>
      </CardPrimitive>
    );
  },
});
