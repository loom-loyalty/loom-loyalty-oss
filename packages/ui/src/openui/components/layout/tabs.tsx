import { z } from "zod";

import { cn } from "../../../lib/utils";
import { TabsContent, TabsList, Tabs as TabsRoot, TabsTrigger } from "../../../primitives/tabs";
import { defineOpenUIComponent } from "../../types";

export const Tabs = defineOpenUIComponent({
  name: "Tabs",
  props: z.object({
    tabs: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      })
    ),
    defaultTab: z.string().optional(),
    children: z.array(z.unknown()).optional(),
  }),
  description:
    "A tabbed container where each tab displays a different child component. Tabs are mapped to children by index.",
  component: ({ props, renderNode }) => {
    const tabs = props.tabs ?? [];
    const children = props.children ?? [];
    const defaultValue = props.defaultTab ?? tabs[0]?.id;

    if (tabs.length === 0) {
      return null;
    }

    return (
      <TabsRoot defaultValue={defaultValue}>
        <TabsList
          className={cn(
            "border-border h-auto rounded-none border-b bg-transparent p-0",
            "inline-flex"
          )}
          aria-label="Content tabs"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "text-muted-foreground rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm font-medium shadow-none transition-colors",
                "hover:text-foreground hover:border-border",
                "data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-none"
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab, index) => (
          <TabsContent key={tab.id} value={tab.id} className="pt-4">
            {index < children.length ? renderNode(children[index]) : null}
          </TabsContent>
        ))}
      </TabsRoot>
    );
  },
});
