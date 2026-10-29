/**
 * UI Schema Generator
 *
 * Generates UI schemas from parsed entity schemas.
 */

import { DEFAULT_FIELD_TYPE_REGISTRY, fieldToUIConfig } from "../registry/field-types.js";
import type { ParsedEntitySchema, ParsedField } from "../types/schema.js";
import type {
  FieldTypeRegistry,
  UIDetailConfig,
  UIEntitySchema,
  UIFieldConfig,
  UIFieldGroup,
  UIFilterConfig,
  UIFormConfig,
  UIListConfig,
} from "../types/ui-schema.js";

/**
 * Generator options
 */
export interface UISchemaGeneratorOptions {
  /** Field type registry for widget/format mapping */
  registry?: FieldTypeRegistry;
  /** Maximum columns to show in list view */
  maxListColumns?: number;
  /** Fields to always hide in list view */
  hideInList?: string[];
  /** Fields to always hide in forms */
  hideInForms?: string[];
  /** Default page size for lists */
  defaultPageSize?: number;
  /** Page size options */
  pageSizes?: number[];
  /** Enable search by default */
  searchable?: boolean;
  /** Enable row selection by default */
  selectable?: boolean;
  /** Row click action */
  rowClickAction?: UIListConfig["rowClickAction"];
  /** Custom entity name (singular) */
  singularName?: string;
  /** Custom entity name (plural) */
  pluralName?: string;
  /** Entity icon */
  icon?: string;
  /** Whether entity supports create */
  canCreate?: boolean;
  /** Whether entity supports edit */
  canEdit?: boolean;
  /** Whether entity supports delete */
  canDelete?: boolean;
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<
  Omit<UISchemaGeneratorOptions, "registry" | "singularName" | "pluralName" | "icon">
> = {
  maxListColumns: 6,
  hideInList: [
    "id",
    "createdAt",
    "updatedAt",
    "created_at",
    "updated_at",
    "deletedAt",
    "deleted_at",
  ],
  hideInForms: [
    "id",
    "createdAt",
    "updatedAt",
    "created_at",
    "updated_at",
    "deletedAt",
    "deleted_at",
  ],
  defaultPageSize: 25,
  pageSizes: [10, 25, 50, 100],
  searchable: true,
  selectable: false,
  rowClickAction: "view",
  canCreate: true,
  canEdit: true,
  canDelete: true,
};

/**
 * Fields that should be grouped together
 */
const FIELD_GROUPS: Record<string, string[]> = {
  identity: ["id", "uuid", "code", "slug"],
  timestamps: ["createdAt", "created_at", "updatedAt", "updated_at", "deletedAt", "deleted_at"],
  metadata: ["metadata", "meta", "extra", "attributes", "properties", "data"],
};

/**
 * Convert entity name to plural form
 */
function pluralize(name: string): string {
  if (name.endsWith("y") && !name.endsWith("ey") && !name.endsWith("oy")) {
    return name.slice(0, -1) + "ies";
  }
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("ch") || name.endsWith("sh")) {
    return name + "es";
  }
  return name + "s";
}

/**
 * Determine which group a field belongs to
 */
function getFieldGroup(fieldName: string): string | undefined {
  for (const [group, fields] of Object.entries(FIELD_GROUPS)) {
    if (fields.includes(fieldName)) {
      return group;
    }
  }
  return undefined;
}

/**
 * Generate field configurations from parsed fields
 */
function generateFieldConfigs(
  fields: Record<string, ParsedField>,
  fieldOrder: string[],
  options: UISchemaGeneratorOptions
): Record<string, UIFieldConfig> {
  const configs: Record<string, UIFieldConfig> = {};
  const { registry = DEFAULT_FIELD_TYPE_REGISTRY, hideInList = [], hideInForms = [] } = options;

  for (const name of fieldOrder) {
    const field = fields[name];
    if (!field) continue;

    const config = fieldToUIConfig(field, {
      registry,
      showInList: !hideInList.includes(name),
      showInDetail: true,
      showInCreate: !hideInForms.includes(name) && !field.readonly,
      showInEdit: !hideInForms.includes(name) && !field.readonly,
    });

    // Assign to a group
    config.group = getFieldGroup(name);

    configs[name] = config;
  }

  return configs;
}

/**
 * Generate list configuration
 */
function generateListConfig(
  fieldConfigs: Record<string, UIFieldConfig>,
  fieldOrder: string[],
  displayField: string | undefined,
  options: Required<
    Omit<UISchemaGeneratorOptions, "registry" | "singularName" | "pluralName" | "icon">
  >
): UIListConfig {
  // Select columns for list view
  const listFields = fieldOrder.filter((name) => {
    const config = fieldConfigs[name];
    return config?.showInList;
  });

  // Prioritize display field, then limit to maxListColumns
  let columns: string[] = [];
  if (displayField && listFields.includes(displayField)) {
    columns.push(displayField);
  }

  for (const name of listFields) {
    if (!columns.includes(name) && columns.length < options.maxListColumns) {
      columns.push(name);
    }
  }

  // Generate filters for filterable columns
  const filters: UIFilterConfig[] = columns
    .filter((name) => fieldConfigs[name]?.filterable)
    .map((name) => {
      const config = fieldConfigs[name]!;
      return {
        field: name,
        type:
          config.widget === "select" ? "select" : config.widget === "switch" ? "boolean" : "text",
        label: config.label,
      };
    });

  // Find searchable fields
  const searchFields = fieldOrder.filter((name) => fieldConfigs[name]?.searchable);

  return {
    columns,
    defaultSort: displayField || columns[0],
    defaultSortDirection: "asc",
    searchable: options.searchable && searchFields.length > 0,
    searchFields,
    filters,
    pageSizes: options.pageSizes,
    defaultPageSize: options.defaultPageSize,
    selectable: options.selectable,
    rowClickAction: options.rowClickAction,
  };
}

/**
 * Generate field groups for forms
 */
function generateFieldGroups(
  fieldConfigs: Record<string, UIFieldConfig>,
  fieldOrder: string[],
  includeTimestamps: boolean,
  includeMetadata: boolean
): UIFieldGroup[] {
  const groups: Map<string, UIFieldGroup> = new Map();

  // Main group for ungrouped fields
  groups.set("main", {
    id: "main",
    label: "General",
    fields: [],
    order: 0,
  });

  // Process fields
  for (const name of fieldOrder) {
    const config = fieldConfigs[name];
    if (!config) continue;

    const groupId = config.group || "main";

    // Skip timestamp and metadata groups unless requested
    if (groupId === "timestamps" && !includeTimestamps) continue;
    if (groupId === "metadata" && !includeMetadata) continue;
    if (groupId === "identity") continue; // Skip identity fields in forms

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        label: groupId.charAt(0).toUpperCase() + groupId.slice(1),
        fields: [],
        order: groups.size,
        collapsible: groupId !== "main",
        defaultCollapsed: groupId === "metadata",
      });
    }

    groups.get(groupId)!.fields.push(name);
  }

  // Remove empty groups
  return Array.from(groups.values()).filter((g) => g.fields.length > 0);
}

/**
 * Generate detail view configuration
 */
function generateDetailConfig(
  fieldConfigs: Record<string, UIFieldConfig>,
  fieldOrder: string[]
): UIDetailConfig {
  const groups = generateFieldGroups(fieldConfigs, fieldOrder, true, true);

  return {
    groups,
    showTimestamps: true,
    showMetadata: true,
  };
}

/**
 * Generate form configuration
 */
function generateFormConfig(
  fieldConfigs: Record<string, UIFieldConfig>,
  fieldOrder: string[],
  isCreate: boolean
): UIFormConfig {
  // Filter fields based on form type
  const formFields = fieldOrder.filter((name) => {
    const config = fieldConfigs[name];
    return isCreate ? config?.showInCreate : config?.showInEdit;
  });

  const groups = generateFieldGroups(fieldConfigs, formFields, false, false);

  return {
    groups,
    validationMode: "onBlur",
    showCancel: true,
    cancelLabel: "Cancel",
    submitLabel: isCreate ? "Create" : "Save Changes",
    showReset: isCreate,
  };
}

/**
 * Generate a complete UI schema from a parsed entity schema
 */
export function generateUISchema(
  entitySchema: ParsedEntitySchema,
  options: UISchemaGeneratorOptions = {}
): UIEntitySchema {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Generate field configurations
  const fieldConfigs = generateFieldConfigs(
    entitySchema.fields,
    entitySchema.fieldOrder,
    mergedOptions
  );

  // Generate view configurations
  const listConfig = generateListConfig(
    fieldConfigs,
    entitySchema.fieldOrder,
    entitySchema.displayField,
    mergedOptions
  );

  const detailConfig = generateDetailConfig(fieldConfigs, entitySchema.fieldOrder);
  const createConfig = generateFormConfig(fieldConfigs, entitySchema.fieldOrder, true);
  const editConfig = generateFormConfig(fieldConfigs, entitySchema.fieldOrder, false);

  // Determine entity names
  const singularName = options.singularName || entitySchema.name;
  const pluralName = options.pluralName || pluralize(singularName);

  return {
    entityCode: entitySchema.code,
    singularName,
    pluralName,
    description: entitySchema.description,
    icon: options.icon,
    displayField: entitySchema.displayField,
    fields: fieldConfigs,
    list: listConfig,
    detail: detailConfig,
    create: createConfig,
    edit: editConfig,
    canCreate: mergedOptions.canCreate,
    canEdit: mergedOptions.canEdit,
    canDelete: mergedOptions.canDelete,
  };
}

/**
 * Generate UI schemas for all entities in a registry
 */
export function generateUISchemas(
  entities: Record<string, ParsedEntitySchema>,
  optionsMap: Record<string, UISchemaGeneratorOptions> = {}
): Record<string, UIEntitySchema> {
  const result: Record<string, UIEntitySchema> = {};

  for (const [code, schema] of Object.entries(entities)) {
    result[code] = generateUISchema(schema, optionsMap[code] || {});
  }

  return result;
}
