/**
 * Types for the metadata sub-type fields shared by the embedded create sheet
 * (MetadataCreateSheet) and the metadata admin form sheet (MetadataFormSheet).
 *
 * A metadata type's `category` decides which extra fields an entry carries and
 * which endpoint its writes go to. `Metadata` is a `oneOf` with no
 * discriminator, so the category is always resolved from the entry's metadata
 * type — never read off the entity.
 */

import type { Coordinates, Item, Location, MetadataTypeCategory } from "@loom-loyalty/sdk";

/**
 * Fields an `Update*` body accepts that this form renders no input for.
 *
 * The sub-type writes are replacements — `PUT /locations/{id}` and its Item
 * sibling rebuild the resource from the body, so a field the body omits is
 * destroyed rather than left alone. These ride through an edit opaquely: read
 * off the loaded entry, re-emitted unchanged.
 */
export interface MetadataPreservedFields {
  /** LOCATION: third address line. */
  addressLine3?: string;
  /** LOCATION: fourth address line. */
  addressLine4?: string;
  /** LOCATION: recurring weekly operating hours. */
  operatingHours?: Location["operatingHours"];
  /** ITEM: search descriptors used for item matching. */
  searchDescriptions?: Item["searchDescriptions"];
}

/**
 * Sub-type form state. Every value is the raw string the user typed, including
 * the coordinates — they are parsed to numbers only when the payload is built.
 */
export interface MetadataSubTypeValues {
  /** DATA_TYPE: code of the referenced data model (required). */
  dataModelCode?: string;
  /** LOCATION: primary street address (required). */
  addressLine1?: string;
  /** LOCATION: secondary address line. */
  addressLine2?: string;
  /** LOCATION: city or locality. */
  cityLocality?: string;
  /** LOCATION: state, province, or region. */
  stateProvinceRegion?: string;
  /** LOCATION: postal/ZIP code. */
  postalCode?: string;
  /** LOCATION: ISO 3166-1 alpha-2 country code (required). */
  countryCode?: string;
  /** LOCATION: latitude in decimal degrees, -90 to 90. */
  latitude?: string;
  /** LOCATION: longitude in decimal degrees, -180 to 180. */
  longitude?: string;
  /** ITEM: unique identifier for the item variant (required). */
  itemVariantId?: string;
  /** ITEM: stock keeping unit. */
  sku?: string;
  /** ITEM: universal product code. */
  upc?: string;
  /**
   * Fields the loaded entry carried that no input renders. Held opaquely and
   * re-emitted unchanged so a replacing write cannot destroy them.
   */
  preserved?: MetadataPreservedFields;
}

/** The sub-type values a user edits — everything but the opaque carry-through. */
export type MetadataSubTypeFieldName = Exclude<keyof MetadataSubTypeValues, "preserved">;

/** Empty sub-type state, used for both initial state and reset. */
export const EMPTY_METADATA_SUB_TYPE_VALUES: MetadataSubTypeValues = {};

/**
 * The sub-type half of a create/update body, matching the API field names on
 * CreateDataType / CreateLocation / CreateItem. It extends the preserved
 * fields because an update body has to carry them too.
 */
export interface MetadataSubTypePayload extends MetadataPreservedFields {
  dataModelCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  cityLocality?: string;
  stateProvinceRegion?: string;
  postalCode?: string;
  countryCode?: string;
  coordinates?: Coordinates;
  itemVariantId?: string;
  sku?: string;
  upc?: string;
}

/** Base fields validated the same way for every category. */
export interface MetadataBaseValues {
  name?: string;
  code?: string;
  description?: Record<string, string>;
}

/** Option for the DATA_TYPE data-model select. */
export interface DataModelOption {
  code: string;
  name: string;
  description?: string;
}

/** Categories that carry their own fields and their own write endpoint. */
export const METADATA_SUB_TYPE_CATEGORIES = ["DATA_TYPE", "LOCATION", "ITEM"] as const;

/** True when the category adds fields beyond the base metadata shape. */
export function isMetadataSubTypeCategory(
  category: MetadataTypeCategory | undefined
): category is "DATA_TYPE" | "LOCATION" | "ITEM" {
  return category === "DATA_TYPE" || category === "LOCATION" || category === "ITEM";
}
