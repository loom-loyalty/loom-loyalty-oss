import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { MultiSelect as MultiSelectPrimitive } from "../../../forms/multi-select";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

export const MultiSelect = defineOpenUIComponent({
  name: "MultiSelect",
  props: z.object({
    label: z.string(),
    name: z.string(),
    options: z.array(z.object({ label: z.string(), value: z.string() })),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A multi-select input that displays options as clickable pills. Users can select multiple values.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = (getFieldValue(formName, props.name ?? "") as string[]) ?? [];

    return (
      <div className="space-y-1.5">
        {props.label && (
          <Label>
            {props.label}
            {props.required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </Label>
        )}
        <MultiSelectPrimitive
          variant="compact"
          options={props.options ?? []}
          value={value}
          onChange={(selected) =>
            setFieldValue(formName, "MultiSelect", props.name ?? "", selected, true)
          }
          aria-label={props.label}
          aria-describedby={props.helpText ? helpId : undefined}
        />
        {props.helpText && (
          <p id={helpId} className="text-muted-foreground text-xs">
            {props.helpText}
          </p>
        )}
      </div>
    );
  },
});
