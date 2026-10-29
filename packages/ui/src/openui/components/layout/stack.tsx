import { z } from "zod";

import { cn } from "../../../lib/utils";
import { defineOpenUIComponent } from "../../types";

const gapMap = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
} as const;

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

export const Stack = defineOpenUIComponent({
  name: "Stack",
  props: z.object({
    direction: z.enum(["row", "column"]).optional(),
    gap: z.enum(["sm", "md", "lg"]).optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    children: z.array(z.unknown()).optional(),
  }),
  description:
    "A flex container for arranging child components in a row or column with configurable gap and alignment. This is the root layout component.",
  component: ({ props, renderNode }) => {
    const direction = props.direction ?? "column";
    const gap = props.gap ?? "md";
    const align = props.align ?? "stretch";
    const children = props.children ?? [];

    return (
      <div
        className={cn(
          "flex",
          direction === "row" ? "flex-row" : "flex-col",
          gapMap[gap],
          alignMap[align]
        )}
      >
        {children.map((child, index) => (
          <div key={index} className={direction === "row" ? "min-w-0" : "w-full"}>
            {renderNode(child)}
          </div>
        ))}
      </div>
    );
  },
});
