import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { DatePicker as DatePickerPrimitive } from "../../../forms/date-picker";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

export const DatePicker = defineOpenUIComponent({
  name: "DatePicker",
  props: z.object({
    label: z.string(),
    name: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
  }),
  description:
    "A labeled date picker field for forms. Opens a calendar popover for date selection.",
  component: ({ props }) => {
    const id = useId();
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
        <DatePickerPrimitive
          id={id}
          value={value ?? undefined}
          onChange={(date) =>
            setFieldValue(formName, "DatePicker", props.name ?? "", date ?? "", true)
          }
          placeholder={props.placeholder ?? "Pick a date"}
        />
      </div>
    );
  },
});
