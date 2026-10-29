import { z } from "zod";

import { FormSection } from "../../../forms/form-section";
import { defineOpenUIComponent } from "../../types";

export const Section = defineOpenUIComponent({
  name: "Section",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    collapsed: z.boolean().optional(),
    children: z.array(z.unknown()).optional(),
  }),
  description:
    "A collapsible section with a title and optional description. Use for grouping related form fields or content areas.",
  component: ({ props, renderNode }) => {
    const children = props.children ?? [];

    return (
      <FormSection
        title={props.title}
        description={props.description}
        collapsed={props.collapsed ?? false}
      >
        {children.map((child, index) => (
          <div key={index}>{renderNode(child)}</div>
        ))}
      </FormSection>
    );
  },
});
