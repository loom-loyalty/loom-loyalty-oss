import {
  useFormName,
  useGetFieldValue,
  useSetDefaultValue,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { Label } from "../../../primitives/label";
import { Switch } from "../../../primitives/switch";
import { defineOpenUIComponent } from "../../types";

export const Toggle = defineOpenUIComponent({
  name: "Toggle",
  props: z.object({
    label: z.string(),
    name: z.string(),
    description: z.string().optional(),
    defaultChecked: z.boolean().optional(),
  }),
  description:
    "A labeled toggle switch for boolean form fields. Includes an optional description below the label.",
  component: ({ props }) => {
    const id = useId();
    const descId = `${id}-desc`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "");

    useSetDefaultValue({
      formName,
      componentType: "Toggle",
      name: props.name ?? "",
      existingValue: value,
      defaultValue: props.defaultChecked ?? false,
    });

    const checked = typeof value === "boolean" ? value : (props.defaultChecked ?? false);

    return (
      <div className="border-border flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={id}>{props.label}</Label>
          {props.description && (
            <p id={descId} className="text-muted-foreground text-xs">
              {props.description}
            </p>
          )}
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={(val) => setFieldValue(formName, "Toggle", props.name ?? "", val, true)}
          aria-describedby={props.description ? descId : undefined}
        />
      </div>
    );
  },
});
