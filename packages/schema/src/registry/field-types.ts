/**
 * Field Type Registry
 *
 * Maps schema data types to UI widget types and display formats.
 */

import type { FieldDataType, FieldFormat, ParsedField } from "../types/schema.js";
import type {
  DisplayFormat,
  FieldTypeMapping,
  FieldTypeRegistry,
  UIFieldConfig,
  WidgetType,
} from "../types/ui-schema.js";

/**
 * Default field type to UI mapping
 */
export const DEFAULT_FIELD_TYPE_REGISTRY: FieldTypeRegistry = {
  string: {
    widget: "text",
    displayFormat: "text",
    sortable: true,
    filterable: true,
  },
  text: {
    widget: "textarea",
    displayFormat: "textarea",
    sortable: false,
    filterable: false,
  },
  number: {
    widget: "number",
    displayFormat: "number",
    columnWidth: "sm",
    sortable: true,
    filterable: true,
  },
  integer: {
    widget: "number",
    displayFormat: "number",
    columnWidth: "sm",
    sortable: true,
    filterable: true,
  },
  boolean: {
    widget: "switch",
    displayFormat: "boolean",
    columnWidth: "sm",
    sortable: true,
    filterable: true,
  },
  date: {
    widget: "date",
    displayFormat: "date",
    columnWidth: "md",
    sortable: true,
    filterable: true,
  },
  datetime: {
    widget: "datetime",
    displayFormat: "datetime",
    columnWidth: "md",
    sortable: true,
    filterable: true,
  },
  time: {
    widget: "time",
    displayFormat: "text",
    columnWidth: "sm",
    sortable: true,
  },
  email: {
    widget: "email",
    displayFormat: "email",
    sortable: true,
    filterable: true,
  },
  url: {
    widget: "url",
    displayFormat: "link",
    sortable: false,
  },
  uuid: {
    widget: "text",
    displayFormat: "text",
    columnWidth: "lg",
    sortable: false,
  },
  enum: {
    widget: "select",
    displayFormat: "badge",
    columnWidth: "md",
    sortable: true,
    filterable: true,
  },
  array: {
    widget: "multi-select",
    displayFormat: "tags",
    sortable: false,
  },
  object: {
    widget: "json",
    displayFormat: "json",
    sortable: false,
  },
  reference: {
    widget: "reference",
    displayFormat: "reference",
    sortable: false,
    filterable: true,
  },
  localized_string: {
    widget: "locale-tabbed-input",
    displayFormat: "text",
    sortable: false,
    filterable: false,
  },
  metadata: {
    widget: "metadata-select",
    displayFormat: "badge",
    columnWidth: "md",
    sortable: true,
    filterable: true,
  },
  currency: {
    widget: "currency",
    displayFormat: "currency",
    columnWidth: "sm",
    sortable: true,
    filterable: true,
  },
  // No dedicated generic-view widget yet — Record Activity dispatches
  // fiat_currency directly to FiatCurrencyInput before this registry is
  // consulted, so this entry only needs to satisfy FieldTypeRegistry's
  // exhaustiveness check for the wider EntityDetail/EntityEdit path.
  fiat_currency: {
    widget: "json",
    displayFormat: "json",
    sortable: false,
  },
  percentage: {
    widget: "percentage",
    displayFormat: "percentage",
    columnWidth: "sm",
    sortable: true,
    filterable: true,
  },
  json: {
    widget: "json",
    displayFormat: "json",
    sortable: false,
  },
};

/**
 * Format-based widget overrides
 *
 * When a field has a specific format, override the default widget/display.
 */
const FORMAT_OVERRIDES: Partial<Record<FieldFormat, Partial<FieldTypeMapping>>> = {
  email: {
    widget: "email",
    displayFormat: "email",
  },
  uri: {
    widget: "url",
    displayFormat: "link",
  },
  uuid: {
    widget: "text",
    displayFormat: "text",
  },
  password: {
    widget: "password",
    displayFormat: "text",
  },
  "date-time": {
    widget: "datetime",
    displayFormat: "datetime",
  },
  date: {
    widget: "date",
    displayFormat: "date",
  },
  time: {
    widget: "time",
    displayFormat: "text",
  },
  currency: {
    widget: "currency",
    displayFormat: "currency",
  },
  percentage: {
    widget: "percentage",
    displayFormat: "percentage",
  },
};

/**
 * Get the UI mapping for a field based on its type and format
 */
export function getFieldTypeMapping(
  type: FieldDataType,
  format?: FieldFormat,
  registry: FieldTypeRegistry = DEFAULT_FIELD_TYPE_REGISTRY
): FieldTypeMapping {
  const baseMapping = registry[type] ?? registry.string;

  // Apply format overrides if available
  if (format && FORMAT_OVERRIDES[format]) {
    return {
      ...baseMapping,
      ...FORMAT_OVERRIDES[format],
    };
  }

  return baseMapping;
}

/**
 * Convert a parsed field to a UI field config
 */
export function fieldToUIConfig(
  field: ParsedField,
  options: {
    registry?: FieldTypeRegistry;
    showInList?: boolean;
    showInDetail?: boolean;
    showInCreate?: boolean;
    showInEdit?: boolean;
  } = {}
): UIFieldConfig {
  const {
    registry = DEFAULT_FIELD_TYPE_REGISTRY,
    showInList = true,
    showInDetail = true,
    showInCreate = true,
    showInEdit = true,
  } = options;

  const mapping = getFieldTypeMapping(field.type, field.format, registry);

  // Determine widget based on field properties
  let widget: WidgetType = mapping.widget;
  let displayFormat: DisplayFormat = mapping.displayFormat;

  // Handle enum fields
  if (field.validation.enum && field.validation.enum.length > 0) {
    widget = "select";
    displayFormat = "badge";
  }

  // Handle reference fields
  if (field.reference) {
    widget = field.reference.isArray ? "reference-multi" : "reference";
    displayFormat = "reference";
  }

  // Handle array fields
  if (field.type === "array" && field.items) {
    if (field.items.type === "string" && field.items.validation.enum) {
      widget = "multi-select";
      displayFormat = "tags";
    } else if (field.items.type === "reference" || field.items.reference) {
      widget = "reference-multi";
      displayFormat = "reference";
    } else if (field.items.type === "metadata") {
      widget = "metadata-select";
      displayFormat = "tags";
    } else if (field.items.type === "localized_string") {
      widget = "locale-tabbed-input";
      displayFormat = "text";
    } else if (field.items.type === "json") {
      widget = "json";
      displayFormat = "json";
    }
  }

  // Handle readonly fields
  if (field.readonly) {
    widget = "readonly";
  }

  // Handle writeOnly fields (like passwords)
  if (field.writeOnly) {
    widget = "password";
  }

  // Long text fields should use textarea — but never override readonly/password.
  if (
    !field.readonly &&
    !field.writeOnly &&
    (field.type === "string" || field.type === "localized_string") &&
    field.validation.maxLength &&
    field.validation.maxLength > 255
  ) {
    widget = field.type === "localized_string" ? "locale-tabbed-input" : "textarea";
  }

  const itemsReferenceEntityCode = field.items?.reference?.entityCode;
  const itemsMetadataType = field.items?.metadataType;
  const itemsMetadataTypeCategory = field.items?.metadataTypeCategory;

  return {
    name: field.name,
    label: field.label,
    helpText: field.description,
    placeholder: undefined,
    widget,
    displayFormat,
    showInList: showInList && !field.writeOnly,
    showInDetail: showInDetail && !field.writeOnly,
    showInCreate: showInCreate && !field.readonly,
    showInEdit: showInEdit && !field.readonly,
    columnWidth: mapping.columnWidth,
    sortable: mapping.sortable,
    filterable: mapping.filterable,
    searchable: (field.type === "string" || field.type === "localized_string") && !field.writeOnly,
    entityCode: field.reference?.entityCode ?? itemsReferenceEntityCode,
    metadataType: field.metadataType ?? itemsMetadataType,
    metadataTypeCategory: field.metadataTypeCategory ?? itemsMetadataTypeCategory,
    originalTypeReference: field.originalTypeReference,
  };
}

/**
 * Create a custom field type registry by extending the default
 */
export function createFieldTypeRegistry(overrides: Partial<FieldTypeRegistry>): FieldTypeRegistry {
  return {
    ...DEFAULT_FIELD_TYPE_REGISTRY,
    ...overrides,
  };
}
