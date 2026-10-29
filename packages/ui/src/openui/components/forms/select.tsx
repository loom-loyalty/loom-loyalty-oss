import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { Label } from "../../../primitives/label";
import {
  SelectContent,
  SelectItem,
  Select as SelectPrimitive,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import { defineOpenUIComponent } from "../../types";

export const Select = defineOpenUIComponent({
  name: "Select",
  props: z.object({
    label: z.string(),
    name: z.string(),
    options: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    ),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A labeled dropdown select field for forms. Renders a list of options the user can choose from.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "") as string;
    const options = props.options ?? [];

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
        <SelectPrimitive
          value={value ?? ""}
          onValueChange={(val) => setFieldValue(formName, "Select", props.name ?? "", val, true)}
          required={props.required}
        >
          <SelectTrigger id={id} aria-describedby={props.helpText ? helpId : undefined}>
            <SelectValue placeholder={props.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectPrimitive>
        {props.helpText && (
          <p id={helpId} className="text-muted-foreground text-xs">
            {props.helpText}
          </p>
        )}
      </div>
    );
  },
});
