import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { JsonInput as JsonInputPrimitive } from "../../../forms/json-input";
import { defineOpenUIComponent } from "../../types";

export const JsonInput = defineOpenUIComponent({
  name: "JsonInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description: "A monospace textarea for JSON input with optional validation on blur.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "") as string;

    return (
      <div className="space-y-1.5">
        <JsonInputPrimitive
          label={props.label}
          value={value ?? ""}
          onChange={(val) => setFieldValue(formName, "JsonInput", props.name ?? "", val, false)}
          validate
          required={props.required}
          aria-label={props.label}
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
