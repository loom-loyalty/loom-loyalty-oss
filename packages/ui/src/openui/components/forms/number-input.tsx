import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { Input } from "../../../primitives/input";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

export const NumberInput = defineOpenUIComponent({
  name: "NumberInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A labeled number input field for forms with optional min, max, and step constraints.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "") as string;

    return (
      <div className="space-y-1.5">
        {props.label && (
          <Label htmlFor={id}>
            {props.label}
            {props.required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </Label>
        )}
        <Input
          id={id}
          type="number"
          name={props.name}
          min={props.min}
          max={props.max}
          step={props.step}
          required={props.required}
          value={value ?? ""}
          onChange={(e) =>
            setFieldValue(formName, "NumberInput", props.name ?? "", e.target.value, true)
          }
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
