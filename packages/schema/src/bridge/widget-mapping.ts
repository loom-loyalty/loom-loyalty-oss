import type { WidgetType } from "../types/ui-schema.js";

export interface OpenUIComponentMapping {
  /** OpenUI component name, or null to skip (hidden fields) */
  component: string | null;
  /** Default props to pass to the component */
  defaultProps: Record<string, unknown>;
}

const WIDGET_TO_OPENUI: Record<WidgetType, OpenUIComponentMapping> = {
  text: { component: "TextInput", defaultProps: {} },
  textarea: { component: "TextInput", defaultProps: { type: "text" } },
  number: { component: "NumberInput", defaultProps: {} },
  currency: { component: "CurrencyInput", defaultProps: {} },
  percentage: { component: "PercentageInput", defaultProps: {} },
  checkbox: { component: "Toggle", defaultProps: {} },
  switch: { component: "Toggle", defaultProps: {} },
  select: { component: "Select", defaultProps: {} },
  "multi-select": { component: "MultiSelect", defaultProps: {} },
  radio: { component: "Select", defaultProps: {} },
  date: { component: "DatePicker", defaultProps: {} },
  datetime: { component: "DateTimeInput", defaultProps: {} },
  time: {
    component: "TextInput",
    defaultProps: { type: "text", helpText: "HH:MM format" },
  },
  email: { component: "TextInput", defaultProps: { type: "email" } },
  url: { component: "TextInput", defaultProps: { type: "url" } },
  password: { component: "TextInput", defaultProps: { type: "password" } },
  color: {
    component: "TextInput",
    defaultProps: { type: "text", helpText: "Hex color (e.g. #ff0000)" },
  },
  file: {
    component: "TextInput",
    defaultProps: { type: "url", helpText: "File URL" },
  },
  image: {
    component: "TextInput",
    defaultProps: { type: "url", helpText: "Image URL" },
  },
  json: { component: "JsonInput", defaultProps: {} },
  code: { component: "JsonInput", defaultProps: {} },
  markdown: { component: "JsonInput", defaultProps: {} },
  "rich-text": { component: "JsonInput", defaultProps: {} },
  reference: { component: "EntitySelect", defaultProps: {} },
  "reference-multi": { component: "MultiSelect", defaultProps: {} },
  "metadata-select": { component: "MetadataSelect", defaultProps: {} },
  "locale-tabbed-input": { component: "LocalizedStringInput", defaultProps: {} },
  tags: { component: "TagsInput", defaultProps: {} },
  hidden: { component: null, defaultProps: {} },
  readonly: { component: "ReadOnlyField", defaultProps: {} },
  custom: {
    component: "TextInput",
    defaultProps: { helpText: "Custom field" },
  },
};

// Note about "metadata-select" — it's not in WidgetType but if needed, MetadataSelect is available

export function getOpenUIMapping(widgetType: WidgetType): OpenUIComponentMapping {
  return WIDGET_TO_OPENUI[widgetType];
}

export { WIDGET_TO_OPENUI };
