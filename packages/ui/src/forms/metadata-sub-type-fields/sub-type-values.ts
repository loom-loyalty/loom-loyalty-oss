/**
 * Validation and payload assembly for the metadata sub-type fields.
 *
 * Both the embedded create sheet and the metadata admin form sheet run these,
 * so a sub-type field rule has one home.
 */

import type { DataType, Item, Location, Metadata, MetadataTypeCategory } from "@loom-loyalty/sdk";

import {
  EMPTY_METADATA_SUB_TYPE_VALUES,
  type MetadataBaseValues,
  type MetadataPreservedFields,
  type MetadataSubTypePayload,
  type MetadataSubTypeValues,
} from "./types";

/** Empty string and whitespace-only both mean "not provided". */
function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The sub-type fields a loaded entry may carry. Which ones are present depends
 * on which member of the `Metadata` union the entry is, and the union carries
 * no discriminator — so every field is read optionally.
 *
 * `countryCode` is not on the read model: a `Location` returns a resolved
 * `country` object while the create/update bodies take a code.
 */
type LoadedSubTypeFields = Partial<
  Pick<
    Location,
    | "addressLine1"
    | "addressLine2"
    | "addressLine3"
    | "addressLine4"
    | "cityLocality"
    | "stateProvinceRegion"
    | "postalCode"
    | "country"
    | "coordinates"
    | "operatingHours"
  > &
    Pick<Item, "itemVariantId" | "searchDescriptions" | "sku" | "upc"> &
    Pick<DataType, "dataModelCode"> & { countryCode: string }
>;

/**
 * Seed the sub-type form state from a loaded entry, for editing.
 *
 * Every field the entry carries is read, without consulting the category:
 * `buildMetadataSubTypePayload` emits only the fields the category owns, so a
 * value read from a different branch can never reach the wire.
 */
export function readMetadataSubTypeValues(entry: Metadata | undefined): MetadataSubTypeValues {
  if (!entry) return { ...EMPTY_METADATA_SUB_TYPE_VALUES };

  const fields = entry as LoadedSubTypeFields;
  const coordinates = fields.coordinates;

  return {
    dataModelCode: fields.dataModelCode,
    addressLine1: fields.addressLine1,
    addressLine2: fields.addressLine2,
    cityLocality: fields.cityLocality,
    stateProvinceRegion: fields.stateProvinceRegion,
    postalCode: fields.postalCode,
    countryCode: fields.countryCode ?? fields.country?.code,
    latitude: coordinates ? String(coordinates.latitude) : undefined,
    longitude: coordinates ? String(coordinates.longitude) : undefined,
    itemVariantId: fields.itemVariantId,
    sku: fields.sku,
    upc: fields.upc,
    preserved: readPreservedFields(fields),
  };
}

/**
 * Capture the `Update*` fields no input renders, so the payload can hand them
 * back untouched. Only keys the entry actually carries are kept — a create has
 * nothing to preserve and must not gain empty ones.
 */
function readPreservedFields(fields: LoadedSubTypeFields): MetadataPreservedFields {
  const preserved: MetadataPreservedFields = {};

  if (fields.addressLine3 !== undefined) preserved.addressLine3 = fields.addressLine3;
  if (fields.addressLine4 !== undefined) preserved.addressLine4 = fields.addressLine4;
  if (fields.operatingHours !== undefined) preserved.operatingHours = fields.operatingHours;
  if (fields.searchDescriptions !== undefined) {
    preserved.searchDescriptions = fields.searchDescriptions;
  }

  return preserved;
}

/**
 * Validate the fields a category adds on top of the base metadata shape.
 * Returned keys match the value keys so a caller can bind them to its inputs.
 */
export function validateMetadataSubType(
  values: MetadataSubTypeValues,
  category: MetadataTypeCategory
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (category === "DATA_TYPE" && !values.dataModelCode) {
    errors.dataModelCode = "Data model is required";
  }

  if (category === "LOCATION") {
    if (!trimmedOrUndefined(values.addressLine1)) {
      errors.addressLine1 = "Address is required";
    }
    if (!values.countryCode) {
      errors.countryCode = "Country is required";
    }
    Object.assign(errors, validateCoordinates(values));
  }

  if (category === "ITEM" && !trimmedOrUndefined(values.itemVariantId)) {
    errors.itemVariantId = "Item variant ID is required";
  }

  return errors;
}

/**
 * Coordinates are optional, but a half-filled pair is not: the API takes
 * `coordinates` as an object with both members required, so one value alone
 * would be silently discarded.
 */
function validateCoordinates(values: MetadataSubTypeValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const latitude = trimmedOrUndefined(values.latitude);
  const longitude = trimmedOrUndefined(values.longitude);

  if (!latitude && !longitude) return errors;

  if (!latitude) errors.latitude = "Latitude is required when longitude is set";
  if (!longitude) errors.longitude = "Longitude is required when latitude is set";

  if (latitude) {
    const parsed = Number(latitude);
    if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
      errors.latitude = "Latitude must be between -90 and 90";
    }
  }
  if (longitude) {
    const parsed = Number(longitude);
    if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
      errors.longitude = "Longitude must be between -180 and 180";
    }
  }

  return errors;
}

/**
 * Validate the base fields plus whatever the category adds. Exported for
 * direct unit tests; the sheets call it on submit.
 */
export function validateMetadataForm(
  data: MetadataBaseValues & MetadataSubTypeValues,
  category: MetadataTypeCategory
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = "Name is required";
  } else if (data.name.length > 128) {
    errors.name = "Name must be 128 characters or less";
  }

  if (!data.code || data.code.trim().length === 0) {
    errors.code = "Code is required";
  } else if (data.code.length > 64) {
    errors.code = "Code must be 64 characters or less";
  } else if (!/^[a-z0-9-]+$/.test(data.code)) {
    errors.code = "Code must contain only lowercase letters, numbers, and hyphens";
  }

  if (data.description) {
    const tooLong = Object.values(data.description).some(
      (v) => typeof v === "string" && v.trim().length > 500
    );
    if (tooLong) {
      errors.description = "Description must be 500 characters or less per language";
    }
  }

  return { ...errors, ...validateMetadataSubType(data, category) };
}

/**
 * Build the sub-type half of a create/update body. Only the fields the
 * category owns are emitted — a stray `sku` on a LOCATION body is rejected by
 * the API, which sets `additionalProperties: false` on every sub-type schema.
 *
 * The category gate covers the preserved fields too: an entry is always of the
 * type whose category this is, so a `searchDescriptions` read from an Item can
 * never ride out on a Location body.
 */
export function buildMetadataSubTypePayload(
  values: MetadataSubTypeValues,
  category: MetadataTypeCategory
): MetadataSubTypePayload {
  const preserved = values.preserved ?? {};

  if (category === "DATA_TYPE") {
    return { dataModelCode: trimmedOrUndefined(values.dataModelCode) };
  }

  if (category === "LOCATION") {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    const hasCoordinates =
      !!trimmedOrUndefined(values.latitude) &&
      !!trimmedOrUndefined(values.longitude) &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);
    const { addressLine3, addressLine4, operatingHours } = preserved;

    return {
      ...(addressLine3 !== undefined ? { addressLine3 } : {}),
      ...(addressLine4 !== undefined ? { addressLine4 } : {}),
      ...(operatingHours !== undefined ? { operatingHours } : {}),
      addressLine1: trimmedOrUndefined(values.addressLine1),
      addressLine2: trimmedOrUndefined(values.addressLine2),
      cityLocality: trimmedOrUndefined(values.cityLocality),
      stateProvinceRegion: trimmedOrUndefined(values.stateProvinceRegion),
      postalCode: trimmedOrUndefined(values.postalCode),
      countryCode: trimmedOrUndefined(values.countryCode),
      ...(hasCoordinates ? { coordinates: { latitude, longitude } } : {}),
    };
  }

  if (category === "ITEM") {
    const { searchDescriptions } = preserved;

    return {
      ...(searchDescriptions !== undefined ? { searchDescriptions } : {}),
      itemVariantId: trimmedOrUndefined(values.itemVariantId),
      sku: trimmedOrUndefined(values.sku),
      upc: trimmedOrUndefined(values.upc),
    };
  }

  return {};
}
