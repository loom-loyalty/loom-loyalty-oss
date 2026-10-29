import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { PercentageInput as PercentageInputPrimitive } from "../../../forms/percentage-input";
import { defineOpenUIComponent } from "../../types";

export const PercentageInput = defineOpenUIComponent({
  name: "PercentageInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description: "A percentage input field (0-100) with a trailing % symbol.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const rawValue = getFieldValue(formName, props.name ?? "");
    const value = rawValue != null ? Number(rawValue) : undefined;

    return (
      <div className="space-y-1.5">
        <PercentageInputPrimitive
          label={props.label}
          value={value}
          onChange={(val) =>
            setFieldValue(
              formName,
              "PercentageInput",
              props.name ?? "",
              val != null ? String(val) : "",
              true
            )
          }
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
