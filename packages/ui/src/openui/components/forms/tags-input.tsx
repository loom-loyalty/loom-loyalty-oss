import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId } from "react";
import { z } from "zod";

import { TagsInput as TagsInputPrimitive } from "../../../forms/tags-input";
import { defineOpenUIComponent } from "../../types";

export const TagsInput = defineOpenUIComponent({
  name: "TagsInput",
  props: z.object({
    label: z.string(),
    name: z.string(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A text input that converts comma/enter-separated values into removable badge chips.",
  component: ({ props }) => {
    const id = useId();
    const helpId = `${id}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const rawValue = getFieldValue(formName, props.name ?? "");
    const value = Array.isArray(rawValue) ? (rawValue as string[]) : [];

    return (
      <div className="space-y-1.5">
        <TagsInputPrimitive
          label={props.label}
          value={value}
          onChange={(tags) => setFieldValue(formName, "TagsInput", props.name ?? "", tags, true)}
          placeholder={props.placeholder}
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
