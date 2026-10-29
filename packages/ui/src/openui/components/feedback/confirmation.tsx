import { useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { Button } from "../../../primitives/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { defineOpenUIComponent } from "../../types";

export const Confirmation = defineOpenUIComponent({
  name: "Confirmation",
  props: z.object({
    title: z.string(),
    message: z.string(),
    confirmLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    confirmAction: z.string(),
    variant: z.enum(["default", "destructive"]).optional(),
  }),
  description:
    "A confirmation dialog card with confirm and cancel buttons. Use for destructive or important actions that need explicit user approval.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const confirmLabel = props.confirmLabel ?? "Confirm";
    const cancelLabel = props.cancelLabel ?? "Cancel";
    const variant = props.variant ?? "default";

    return (
      <CardPrimitive>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{props.message}</p>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => triggerAction("cancel")}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => triggerAction(props.confirmAction)}
          >
            {confirmLabel}
          </Button>
        </CardFooter>
      </CardPrimitive>
    );
  },
});
