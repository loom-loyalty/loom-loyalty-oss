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

export const MetadataSelect = defineOpenUIComponent({
  name: "MetadataSelect",
  props: z.object({
    label: z.string(),
    name: z.string(),
    metadataTypeLabel: z.string(),
    options: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
      })
    ),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A select dropdown for choosing metadata values (e.g., categories, tags). Displays options by name and stores the code as the value.",
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
          onValueChange={(val) =>
            setFieldValue(formName, "MetadataSelect", props.name ?? "", val, true)
          }
          required={props.required}
        >
          <SelectTrigger id={id} aria-describedby={props.helpText ? helpId : undefined}>
            <SelectValue placeholder={`Select ${props.metadataTypeLabel ?? "option"}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name}
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
