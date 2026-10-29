import { z } from "zod";

import { cn } from "../../../lib/utils";
import {
  CardContent,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

export const TierConfig = defineOpenUIComponent({
  name: "TierConfig",
  props: z.object({
    tiers: z.array(
      z.object({
        name: z.string(),
        code: z.string(),
        pointsThreshold: z.number(),
      })
    ),
  }),
  description:
    "A read-only card displaying loyalty tier configuration with name and points threshold for each tier.",
  component: ({ props }) => {
    const tiers = props.tiers ?? [];

    return (
      <CardPrimitive>
        <CardHeader>
          <CardTitle>Tier Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div
                key={tier.code}
                className={cn(
                  "border-border flex items-center gap-4 rounded-md border p-3",
                  index === 0 && "bg-muted/30"
                )}
              >
                <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-foreground text-sm font-medium">{tier.name}</Label>
                  <p className="text-muted-foreground text-xs">Code: {tier.code}</p>
                </div>
                <p className="text-foreground w-32 text-right text-sm font-medium">
                  {tier.pointsThreshold.toLocaleString()} pts
                </p>
              </div>
            ))}
            {tiers.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm" role="status">
                No tiers configured
              </p>
            )}
          </div>
        </CardContent>
      </CardPrimitive>
    );
  },
});
