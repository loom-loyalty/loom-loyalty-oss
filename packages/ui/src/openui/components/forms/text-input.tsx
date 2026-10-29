import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { Input } from "../../../primitives/input";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

export const TextInput = defineOpenUIComponent({
  name: "TextInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
    type: z.enum(["text", "email", "url", "password"]).optional(),
  }),
  description:
    "A labeled text input field for forms. Supports text, email, URL, and password types with optional help text.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "") as string;
    const inputType = props.type ?? "text";

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
          type={inputType}
          name={props.name}
          placeholder={props.placeholder}
          required={props.required}
          value={value ?? ""}
          onChange={(e) =>
            setFieldValue(formName, "TextInput", props.name ?? "", e.target.value, false)
          }
          onBlur={() => setFieldValue(formName, "TextInput", props.name ?? "", value ?? "", true)}
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
