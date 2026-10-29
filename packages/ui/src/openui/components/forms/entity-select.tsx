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

export const EntitySelect = defineOpenUIComponent({
  name: "EntitySelect",
  props: z.object({
    label: z.string(),
    name: z.string(),
    entityLabel: z.string(),
    options: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A select dropdown for choosing an entity (e.g., partner, program). Displays options by name and stores the ID as the value.",
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
            setFieldValue(formName, "EntitySelect", props.name ?? "", val, true)
          }
          required={props.required}
        >
          <SelectTrigger id={id} aria-describedby={props.helpText ? helpId : undefined}>
            <SelectValue placeholder={`Select ${props.entityLabel ?? "entity"}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
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
