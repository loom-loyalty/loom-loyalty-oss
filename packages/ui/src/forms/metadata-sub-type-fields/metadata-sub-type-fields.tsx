/**
 * MetadataSubTypeFields — the fields a metadata entry carries beyond the base
 * name/code/description, one branch per metadata type category:
 *
 * - DATA_TYPE: dataModelCode
 * - LOCATION: address lines, city/state/postal, country, coordinates
 * - ITEM: itemVariantId, sku, upc
 *
 * Rendered by both the embedded MetadataCreateSheet and the metadata admin
 * MetadataFormSheet so the field rules have one home.
 */

"use client";

import type { MetadataTypeCategory } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";

import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { Skeleton } from "../../primitives/skeleton";
import type { MetadataOption } from "../metadata-select-box";
import type { DataModelOption, MetadataSubTypeFieldName, MetadataSubTypeValues } from "./types";

export interface MetadataSubTypeFieldsProps {
  /** Category of the metadata type the entry belongs to. */
  category: MetadataTypeCategory;
  /** Current sub-type field values. */
  values: MetadataSubTypeValues;
  /** Called with the changed field and its new raw value. */
  onChange: (field: MetadataSubTypeFieldName, value: string) => void;
  /** Per-field validation messages, keyed by value name. */
  errors?: Record<string, string>;
  /** Disable every control (submitting). */
  disabled?: boolean;
  /** Available data models for the DATA_TYPE branch. */
  dataModelOptions?: DataModelOption[];
  isLoadingDataModels?: boolean;
  /** Available countries for the LOCATION branch. */
  countryOptions?: MetadataOption[];
  isLoadingCountries?: boolean;
}

export function MetadataSubTypeFields({
  category,
  values,
  onChange,
  errors = {},
  disabled = false,
  dataModelOptions = [],
  isLoadingDataModels = false,
  countryOptions = [],
  isLoadingCountries = false,
}: MetadataSubTypeFieldsProps): ReactNode {
  if (category === "DATA_TYPE") {
    return (
      <div className="space-y-2">
        <Label
          htmlFor="metadata-datamodel"
          className={errors.dataModelCode ? "text-destructive" : ""}
        >
          Data Model Type <span className="text-destructive">*</span>
        </Label>
        {isLoadingDataModels ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select
            value={values.dataModelCode ?? ""}
            onValueChange={(v) => onChange("dataModelCode", v)}
            disabled={disabled}
          >
            <SelectTrigger id="metadata-datamodel" aria-invalid={!!errors.dataModelCode}>
              <SelectValue placeholder="Select a data model type..." />
            </SelectTrigger>
            <SelectContent>
              {dataModelOptions.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  <div className="flex flex-col items-start">
                    <span>{option.name}</span>
                    {option.description && (
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <FieldError message={errors.dataModelCode} />
        <EmptyOptionsHint
          isLoading={isLoadingDataModels}
          count={dataModelOptions.length}
          message="No data model types are available for this metadata type yet."
        />
      </div>
    );
  }

  if (category === "LOCATION") {
    return (
      <>
        <div className="space-y-2">
          <Label
            htmlFor="metadata-address1"
            className={errors.addressLine1 ? "text-destructive" : ""}
          >
            Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="metadata-address1"
            data-widget="text-input"
            placeholder="Street address"
            value={values.addressLine1 ?? ""}
            onChange={(e) => onChange("addressLine1", e.target.value)}
            disabled={disabled}
            aria-invalid={!!errors.addressLine1}
          />
          <FieldError message={errors.addressLine1} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="metadata-address2">Address Line 2</Label>
          <Input
            id="metadata-address2"
            data-widget="text-input"
            placeholder="Apt, suite, unit, etc."
            value={values.addressLine2 ?? ""}
            onChange={(e) => onChange("addressLine2", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="metadata-city">City</Label>
            <Input
              id="metadata-city"
              data-widget="text-input"
              placeholder="City"
              value={values.cityLocality ?? ""}
              onChange={(e) => onChange("cityLocality", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metadata-state">State/Province</Label>
            <Input
              id="metadata-state"
              data-widget="text-input"
              placeholder="State"
              value={values.stateProvinceRegion ?? ""}
              onChange={(e) => onChange("stateProvinceRegion", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="metadata-postal">Postal Code</Label>
            <Input
              id="metadata-postal"
              data-widget="text-input"
              placeholder="ZIP/Postal"
              value={values.postalCode ?? ""}
              onChange={(e) => onChange("postalCode", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="metadata-country"
              className={errors.countryCode ? "text-destructive" : ""}
            >
              Country <span className="text-destructive">*</span>
            </Label>
            {isLoadingCountries ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={values.countryCode ?? ""}
                onValueChange={(v) => onChange("countryCode", v)}
                disabled={disabled}
              >
                <SelectTrigger id="metadata-country" aria-invalid={!!errors.countryCode}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError message={errors.countryCode} />
            <EmptyOptionsHint
              isLoading={isLoadingCountries}
              count={countryOptions.length}
              message="No countries are configured. Add COUNTRY metadata values first."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="metadata-latitude"
              className={errors.latitude ? "text-destructive" : ""}
            >
              Latitude
            </Label>
            <Input
              id="metadata-latitude"
              data-widget="text-input"
              inputMode="decimal"
              placeholder="37.7887"
              value={values.latitude ?? ""}
              onChange={(e) => onChange("latitude", e.target.value)}
              disabled={disabled}
              aria-invalid={!!errors.latitude}
              className="font-mono"
            />
            <FieldError message={errors.latitude} />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="metadata-longitude"
              className={errors.longitude ? "text-destructive" : ""}
            >
              Longitude
            </Label>
            <Input
              id="metadata-longitude"
              data-widget="text-input"
              inputMode="decimal"
              placeholder="-122.3969"
              value={values.longitude ?? ""}
              onChange={(e) => onChange("longitude", e.target.value)}
              disabled={disabled}
              aria-invalid={!!errors.longitude}
              className="font-mono"
            />
            <FieldError message={errors.longitude} />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Optional map coordinates in decimal degrees. Set both or neither.
        </p>
      </>
    );
  }

  if (category === "ITEM") {
    return (
      <>
        <div className="space-y-2">
          <Label
            htmlFor="metadata-variant"
            className={errors.itemVariantId ? "text-destructive" : ""}
          >
            Item Variant ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="metadata-variant"
            data-widget="text-input"
            placeholder="e.g., SKU-001-RED-L"
            value={values.itemVariantId ?? ""}
            onChange={(e) => onChange("itemVariantId", e.target.value)}
            disabled={disabled}
            aria-invalid={!!errors.itemVariantId}
            className="font-mono"
          />
          <FieldError message={errors.itemVariantId} />
          <p className="text-muted-foreground text-sm">Unique identifier for this item variant</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="metadata-sku">SKU</Label>
            <Input
              id="metadata-sku"
              data-widget="text-input"
              placeholder="Stock keeping unit"
              value={values.sku ?? ""}
              onChange={(e) => onChange("sku", e.target.value)}
              disabled={disabled}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metadata-upc">UPC</Label>
            <Input
              id="metadata-upc"
              data-widget="text-input"
              placeholder="Universal product code"
              value={values.upc ?? ""}
              onChange={(e) => onChange("upc", e.target.value)}
              disabled={disabled}
              className="font-mono"
            />
          </div>
        </div>
      </>
    );
  }

  return null;
}

/**
 * A required select with nothing to select is a dead end. Say why instead of
 * leaving an empty dropdown next to a field the form refuses to submit without.
 */
function EmptyOptionsHint({
  isLoading,
  count,
  message,
}: {
  isLoading: boolean;
  count: number;
  message: string;
}): ReactNode {
  if (isLoading || count > 0) return null;
  return <p className="text-muted-foreground text-sm">{message}</p>;
}

function FieldError({ message }: { message?: string }): ReactNode {
  if (!message) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {message}
    </p>
  );
}
