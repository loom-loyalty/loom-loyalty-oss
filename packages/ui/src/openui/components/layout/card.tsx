import { z } from "zod";

import {
  CardContent,
  CardDescription,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { defineOpenUIComponent } from "../../types";

export const Card = defineOpenUIComponent({
  name: "Card",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    children: z.array(z.unknown()).optional(),
  }),
  description:
    "A card container with optional title and description. Use for grouping related content with a visual boundary.",
  component: ({ props, renderNode }) => {
    const children = props.children ?? [];

    return (
      <CardPrimitive>
        {(props.title || props.description) && (
          <CardHeader>
            <div>
              {props.title && <CardTitle>{props.title}</CardTitle>}
              {props.description && <CardDescription>{props.description}</CardDescription>}
            </div>
          </CardHeader>
        )}
        {children.length > 0 && (
          // Skip CardContent when there are no children so header-only Cards don't render an empty padded box.
          <CardContent>
            {children.map((child, index) => (
              <div key={index}>{renderNode(child)}</div>
            ))}
          </CardContent>
        )}
      </CardPrimitive>
    );
  },
});
