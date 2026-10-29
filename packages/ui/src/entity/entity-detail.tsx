/**
 * EntityDetail Component
 *
 * A schema-driven detail view component that renders entity data
 * in organized groups based on a UI schema configuration.
 */

import {
  formatDateTime,
  formatRelativeTime,
  formatShortDate,
  toISODateTime,
} from "@loom-loyalty/core";
import type { UIEntitySchema, UIFieldConfig } from "@loom-loyalty/schema";
import { ArrowLeft, Edit, MoreHorizontal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { safeHref, safeMailto } from "../lib/safe-href.js";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu.js";
import { Separator } from "../primitives/separator.js";
import { Skeleton } from "../primitives/skeleton.js";
import { formatLocalizedFieldValue } from "./format-utils.js";

/**
 * Entity data record type
 */
export type EntityRecord = Record<string, unknown>;

/**
 * Detail action handler
 */
export interface DetailAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

/**
 * EntityDetail props
 */
export interface EntityDetailProps {
  /** UI schema for the entity */
  schema: UIEntitySchema;
  /** Entity data record */
  data: EntityRecord | null;
  /** Loading state */
  isLoading?: boolean;
  /** Back button click handler */
  onBackClick?: () => void;
  /** Edit button click handler */
  onEditClick?: () => void;
  /** Delete button click handler */
  onDeleteClick?: () => void;
  /** Additional actions */
  actions?: DetailAction[];
  /** Custom field renderer */
  renderField?: (field: UIFieldConfig, value: unknown, record: EntityRecord) => ReactNode;
  /** Custom empty state */
  emptyState?: ReactNode;
  /** Show timestamps section */
  showTimestamps?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Format a field value for display
 */
function formatFieldValue(field: UIFieldConfig, value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const localized = formatLocalizedFieldValue(field, value);
  if (localized !== null) return localized;

  switch (field.displayFormat) {
    case "boolean":
      return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>;

    case "badge":
    case "status":
      return (
        <Badge variant="outline" className="capitalize">
          {String(value).replace(/[-_]/g, " ")}
        </Badge>
      );

    case "date":
      return formatShortDate(String(value));

    case "datetime":
      return formatDateTime(String(value));

    case "relative-time":
      return formatRelativeTime(String(value));

    case "currency":
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(Number(value));

    case "percentage":
      return `${Number(value).toFixed(1)}%`;

    case "number":
      return new Intl.NumberFormat().format(Number(value));

    case "email": {
      const href = safeMailto(value);
      return href ? (
        <a href={href} className="text-primary hover:underline">
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "link": {
      const href = safeHref(value);
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "tags":
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {String(tag)}
              </Badge>
            ))}
          </div>
        );
      }
      return String(value);

    case "reference":
      return String(value);

    case "json":
      return (
        <pre className="bg-muted max-h-40 overflow-auto rounded p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    case "textarea":
    case "rich-text":
      return <p className="text-sm whitespace-pre-wrap">{String(value)}</p>;

    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

/**
 * Field display component
 */
function FieldDisplay({
  field,
  value,
  renderField,
  record,
}: {
  field: UIFieldConfig;
  value: unknown;
  renderField?: EntityDetailProps["renderField"];
  record: EntityRecord;
}): ReactNode {
  const displayValue = renderField
    ? renderField(field, value, record)
    : formatFieldValue(field, value);

  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-sm font-medium">{field.label}</dt>
      <dd>{displayValue as ReactNode}</dd>
    </div>
  );
}

/**
 * A compact, embeddable read-only field list that shares EntityDetail's
 * type-aware value formatting without bringing along its header or timestamps.
 */
export interface EntityDetailFieldsProps {
  fields: UIFieldConfig[];
  data: EntityRecord;
  renderField?: EntityDetailProps["renderField"];
  layout?: "grid" | "inline";
}

export function EntityDetailFields({
  fields,
  data,
  renderField,
  layout = "grid",
}: EntityDetailFieldsProps): ReactNode {
  return (
    <dl
      className={cn(
        "grid gap-6",
        layout === "inline" ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-2"
      )}
    >
      {fields.map((field) => {
        const isFullWidth =
          field.displayFormat === "textarea" ||
          field.displayFormat === "rich-text" ||
          field.displayFormat === "json";

        return (
          <div key={field.name} className={cn(isFullWidth && "md:col-span-2")}>
            <FieldDisplay
              field={field}
              value={data[field.name]}
              renderField={renderField}
              record={data}
            />
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Loading skeleton for detail view
 */
function DetailSkeleton({
  groupCount = 2,
  fieldsPerGroup = 4,
}: {
  groupCount?: number;
  fieldsPerGroup?: number;
}) {
  return (
    <div className="space-y-8">
      {Array.from({ length: groupCount }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: fieldsPerGroup }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * EntityDetail component
 */
export function EntityDetail({
  schema,
  data,
  isLoading = false,
  onBackClick,
  onEditClick,
  onDeleteClick,
  actions,
  renderField,
  emptyState,
  showTimestamps = true,
  className,
}: EntityDetailProps): ReactNode {
  const hasActions = (actions && actions.length > 0) || onEditClick || onDeleteClick;

  // Get the display name from the data
  const displayName =
    data && schema.displayField
      ? String(data[schema.displayField] ?? schema.singularName)
      : schema.singularName;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBackClick && (
            <Button variant="ghost" size="sm" onClick={onBackClick}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isLoading ? <Skeleton className="h-8 w-48" /> : displayName}
            </h1>
            {!isLoading && schema.description && (
              <p className="text-muted-foreground mt-1 text-sm">{schema.description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {hasActions && !isLoading && (
          <div className="flex items-center gap-2">
            {schema.canEdit && onEditClick && (
              <Button variant="primary-gradient" onClick={onEditClick}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {actions && actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={action.onClick}
                      className={cn(action.destructive && "text-destructive")}
                    >
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {schema.canDelete && onDeleteClick && (
                    <>
                      <Separator className="my-1" />
                      <DropdownMenuItem onClick={onDeleteClick} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!actions?.length && schema.canDelete && onDeleteClick && (
              <Button variant="outline" onClick={onDeleteClick} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Content */}
      {isLoading ? (
        <DetailSkeleton />
      ) : !data ? (
        emptyState || (
          <div className="text-muted-foreground py-12 text-center">
            <p>{schema.singularName} not found</p>
            {onBackClick && (
              <Button variant="link" onClick={onBackClick} className="mt-2">
                Go back
              </Button>
            )}
          </div>
        )
      ) : (
        <div className="space-y-8">
          {/* Field groups */}
          {schema.detail.groups.map((group) => {
            const groupFields = group.fields.filter(
              (fieldName) => schema.fields[fieldName]?.showInDetail !== false
            );

            if (groupFields.length === 0) return null;

            return (
              <section key={group.label} className="space-y-4">
                <h2 className="text-lg font-medium">{group.label}</h2>
                <EntityDetailFields
                  fields={groupFields.flatMap((fieldName) => {
                    const field = schema.fields[fieldName];
                    return field ? [field] : [];
                  })}
                  data={data}
                  renderField={renderField}
                  layout={group.layout === "inline" ? "inline" : "grid"}
                />
              </section>
            );
          })}

          {/* Timestamps */}
          {showTimestamps && schema.detail.showTimestamps && (
            <section className="space-y-4">
              <Separator />
              <div className="text-muted-foreground flex flex-wrap gap-6 text-sm">
                {data.createdAt != null && (
                  <div>
                    Created:{" "}
                    <time dateTime={toISODateTime(new Date(String(data.createdAt))) ?? ""}>
                      {formatDateTime(String(data.createdAt))}
                    </time>
                  </div>
                )}
                {data.updatedAt != null && (
                  <div>
                    Updated:{" "}
                    <time dateTime={toISODateTime(new Date(String(data.updatedAt))) ?? ""}>
                      {formatDateTime(String(data.updatedAt))}
                    </time>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
