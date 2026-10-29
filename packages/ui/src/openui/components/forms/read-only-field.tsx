import { z } from "zod";

import { ReadOnlyField as ReadOnlyFieldPrimitive } from "../../../forms/read-only-field";
import { defineOpenUIComponent } from "../../types";

export const ReadOnlyField = defineOpenUIComponent({
  name: "ReadOnlyField",
  props: z.object({
    label: z.string(),
    name: z.string(),
    value: z.string(),
  }),
  description: "A read-only display field showing a label and non-editable value.",
  component: ({ props }) => {
    return <ReadOnlyFieldPrimitive label={props.label ?? ""} value={props.value ?? ""} />;
  },
});
