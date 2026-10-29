import { FormNameContext, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { Button } from "../../../primitives/button";
import { defineOpenUIComponent } from "../../types";

export const FormGroup = defineOpenUIComponent({
  name: "FormGroup",
  props: z.object({
    name: z.string(),
    submitAction: z.string(),
    submitLabel: z.string().optional(),
    children: z.array(z.unknown()).optional(),
  }),
  description:
    "A form container that groups input fields and provides a submit button. Fires the specified action on submit.",
  component: ({ props, renderNode }) => {
    const triggerAction = useTriggerAction();
    const children = props.children ?? [];
    const submitLabel = props.submitLabel ?? "Submit";

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (props.submitAction) {
        triggerAction(props.submitAction, props.name);
      }
    };

    return (
      <FormNameContext.Provider value={props.name}>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label={props.name}>
          {children.map((child, index) => (
            <div key={index}>{renderNode(child)}</div>
          ))}
          <div className="flex justify-end pt-2">
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </FormNameContext.Provider>
    );
  },
});
