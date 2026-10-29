import type {
  UIEntitySchema,
  UIFieldConfig,
  UIFieldGroup,
  UIFormConfig,
} from "../types/ui-schema.js";
import { getOpenUIMapping } from "./widget-mapping.js";

function formatFieldLine(index: number, field: UIFieldConfig, required: boolean): string {
  const mapping = getOpenUIMapping(field.widget);
  if (!mapping.component) return "";

  const componentName = mapping.component;
  const propsStr =
    Object.keys(mapping.defaultProps).length > 0
      ? `[${Object.entries(mapping.defaultProps)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ")}]`
      : "";

  const reqStr = required ? "required" : "optional";
  const desc = field.helpText || field.label;

  return `${index}. ${field.name} (${componentName}${propsStr}, ${reqStr}): ${desc}`;
}

function formatGroups(groups: UIFieldGroup[]): string {
  if (groups.length === 0) return "";

  const lines = groups.map((g) => `- "${g.label}": ${g.fields.join(", ")}`);
  return `\n### Field Groups:\n${lines.join("\n")}`;
}

function formatFormFields(
  form: UIFormConfig,
  fields: Record<string, UIFieldConfig>,
  label: string
): string {
  const allFieldNames = form.groups.flatMap((g) => g.fields);
  const lines: string[] = [];
  let index = 1;

  for (const fieldName of allFieldNames) {
    const field = fields[fieldName];
    if (!field) continue;

    const required = true; // Default assumption; could be enhanced with schema info
    const line = formatFieldLine(index, field, required);
    if (line) {
      lines.push(line);
      index++;
    }
  }

  if (lines.length === 0) return "";
  return `\n### ${label} (in order):\n${lines.join("\n")}`;
}

export function entitySchemaToPromptFragment(entityCode: string, schema: UIEntitySchema): string {
  const parts: string[] = [];

  parts.push(
    `## Entity: ${schema.singularName} (${entityCode})`,
    `Can create: ${schema.canCreate ? "yes" : "no"} | Can edit: ${schema.canEdit ? "yes" : "no"} | Can delete: ${schema.canDelete ? "yes" : "no"}`
  );

  if (schema.canCreate) {
    const createFields = formatFormFields(schema.create, schema.fields, "Create Form Fields");
    if (createFields) parts.push(createFields);
  }

  if (schema.canEdit) {
    const editFields = formatFormFields(schema.edit, schema.fields, "Edit Form Fields");
    if (editFields) parts.push(editFields);
  }

  const groups = schema.create.groups.length > 0 ? schema.create.groups : schema.edit.groups;
  const groupsStr = formatGroups(groups);
  if (groupsStr) parts.push(groupsStr);

  return parts.join("\n");
}
