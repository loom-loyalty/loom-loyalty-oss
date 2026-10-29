import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { CurrencyInput as CurrencyInputPrimitive } from "../../../forms/currency-input";
import { defineOpenUIComponent } from "../../types";

export const CurrencyInput = defineOpenUIComponent({
  name: "CurrencyInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    symbol: z.string().optional(),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description: "A currency input field with a leading symbol (e.g. $). Value is a number.",
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
        <CurrencyInputPrimitive
          label={props.label}
          value={value}
          onChange={(val) =>
            setFieldValue(
              formName,
              "CurrencyInput",
              props.name ?? "",
              val != null ? String(val) : "",
              true
            )
          }
          symbol={props.symbol}
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
