import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { DateTimeInput as DateTimeInputPrimitive } from "../../../forms/date-time-input";
import { defineOpenUIComponent } from "../../types";

export const DateTimeInput = defineOpenUIComponent({
  name: "DateTimeInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A combined date and time input field. Renders a date picker and time input side by side.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const value = getFieldValue(formName, props.name ?? "") as string;

    return (
      <div className="space-y-1.5">
        <DateTimeInputPrimitive
          label={props.label}
          value={value ?? ""}
          onChange={(val) => setFieldValue(formName, "DateTimeInput", props.name ?? "", val, true)}
          required={props.required}
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
