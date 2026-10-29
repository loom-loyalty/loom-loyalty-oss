import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { defineOpenUIComponent } from "../../types";

export const ListBlock = defineOpenUIComponent({
  name: "ListBlock",
  props: z.object({
    items: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        badge: z.string().optional(),
      })
    ),
    ordered: z.boolean().optional(),
  }),
  description:
    "A styled list of items, each with a title, optional description, and optional badge. Supports ordered and unordered lists.",
  component: ({ props }) => {
    const items = props.items ?? [];
    const ordered = props.ordered ?? false;
    const ListTag = ordered ? "ol" : "ul";

    return (
      <ListTag className={cn("space-y-2", ordered && "list-decimal pl-5")} role="list">
        {items.map((item, index) => (
          <li
            key={index}
            className={cn("border-border rounded-md border p-3", !ordered && "list-none")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">{item.title}</p>
                {item.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>
                )}
              </div>
              {item.badge && (
                <Badge variant="secondary" className="shrink-0">
                  {item.badge}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ListTag>
    );
  },
});
