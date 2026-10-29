/**
 * Unit coverage for the sub-type field rules that the sheets only exercise
 * indirectly: coordinate bounds, and the round trip that keeps an `Update*`
 * field alive when no input renders it.
 */

import type { Item, Location } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import {
  buildMetadataSubTypePayload,
  readMetadataSubTypeValues,
  validateMetadataSubType,
} from "./sub-type-values";
import type { MetadataSubTypeValues } from "./types";

/** A LOCATION entry needs an address and a country before coordinates matter. */
function locationValues(overrides: Partial<MetadataSubTypeValues> = {}): MetadataSubTypeValues {
  return { addressLine1: "500 Mission St", countryCode: "US", ...overrides };
}

describe("validateMetadataSubType — coordinate bounds", () => {
  it("accepts a well-formed pair", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "37.7887", longitude: "-122.3969" }),
      "LOCATION"
    );
    expect(errors).toEqual({});
  });

  it("accepts the inclusive boundaries 90 and -180", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "90", longitude: "-180" }),
      "LOCATION"
    );
    expect(errors).toEqual({});
  });

  it("accepts the opposite boundaries -90 and 180", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "-90", longitude: "180" }),
      "LOCATION"
    );
    expect(errors).toEqual({});
  });

  it("rejects a latitude past 90", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "200", longitude: "0" }),
      "LOCATION"
    );
    expect(errors.latitude).toBe("Latitude must be between -90 and 90");
    expect(errors.longitude).toBeUndefined();
  });

  it("rejects a latitude below -90", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "-90.1", longitude: "0" }),
      "LOCATION"
    );
    expect(errors.latitude).toBe("Latitude must be between -90 and 90");
  });

  it("rejects a longitude past 180", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "0", longitude: "181" }),
      "LOCATION"
    );
    expect(errors.longitude).toBe("Longitude must be between -180 and 180");
    expect(errors.latitude).toBeUndefined();
  });

  it("rejects a longitude below -180", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "0", longitude: "-180.5" }),
      "LOCATION"
    );
    expect(errors.longitude).toBe("Longitude must be between -180 and 180");
  });

  it("rejects a non-numeric latitude rather than sending NaN", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "abc", longitude: "0" }),
      "LOCATION"
    );
    expect(errors.latitude).toBe("Latitude must be between -90 and 90");
  });

  it("rejects a non-numeric longitude rather than sending NaN", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "0", longitude: "abc" }),
      "LOCATION"
    );
    expect(errors.longitude).toBe("Longitude must be between -180 and 180");
  });

  it("reports both members when both are out of range", () => {
    const errors = validateMetadataSubType(
      locationValues({ latitude: "200", longitude: "181" }),
      "LOCATION"
    );
    expect(errors.latitude).toBe("Latitude must be between -90 and 90");
    expect(errors.longitude).toBe("Longitude must be between -180 and 180");
  });

  it("leaves an empty pair alone — coordinates are optional", () => {
    const errors = validateMetadataSubType(locationValues(), "LOCATION");
    expect(errors).toEqual({});
  });
});

// A sub-type write replaces the resource, so a field the body omits is
// destroyed. The fields no input renders have to survive the round trip.

const STORED_LOCATION = {
  metadataId: "meta_0000000000000000000000000000a001",
  locationId: "loca_0000000000000000000000000000b001",
  code: "cafe-hq",
  name: "Café HQ",
  typeCode: "STORE_LOCATION",
  addressLine1: "500 Mission St",
  addressLine3: "Building C",
  addressLine4: "Dock 7",
  operatingHours: {
    timeZone: "America/Los_Angeles",
    schedule: { MONDAY: { openTime: "07:00", closeTime: "19:00" } },
  },
  country: {
    metadataId: "meta_0000000000000000000000000000c001",
    code: "US",
    name: "United States",
    typeCode: "COUNTRY",
    alpha3Code: "USA",
  },
} as Location;

const STORED_ITEM = {
  metadataId: "meta_0000000000000000000000000000a002",
  itemId: "item_0000000000000000000000000000b002",
  code: "latte",
  name: "Latte",
  typeCode: "PRODUCT",
  itemVariantId: "SKU-001-12OZ",
  searchDescriptions: ["espresso", "hot drink"],
} as Item;

describe("readMetadataSubTypeValues / buildMetadataSubTypePayload — round trip", () => {
  it("re-emits a Location's unrendered fields unchanged", () => {
    const payload = buildMetadataSubTypePayload(
      readMetadataSubTypeValues(STORED_LOCATION),
      "LOCATION"
    );
    expect(payload.addressLine3).toBe("Building C");
    expect(payload.addressLine4).toBe("Dock 7");
    expect(payload.operatingHours).toEqual(STORED_LOCATION.operatingHours);
  });

  it("re-emits an Item's searchDescriptions unchanged", () => {
    const payload = buildMetadataSubTypePayload(readMetadataSubTypeValues(STORED_ITEM), "ITEM");
    expect(payload.searchDescriptions).toEqual(["espresso", "hot drink"]);
  });

  it("keeps a Location's preserved fields off an Item body, and the reverse", () => {
    const itemPayload = buildMetadataSubTypePayload(
      readMetadataSubTypeValues(STORED_LOCATION),
      "ITEM"
    );
    expect(itemPayload).not.toHaveProperty("addressLine3");
    expect(itemPayload).not.toHaveProperty("operatingHours");

    const locationPayload = buildMetadataSubTypePayload(
      readMetadataSubTypeValues(STORED_ITEM),
      "LOCATION"
    );
    expect(locationPayload).not.toHaveProperty("searchDescriptions");
  });

  it("emits no preserved keys for a create, where there is no entry to read", () => {
    const payload = buildMetadataSubTypePayload(readMetadataSubTypeValues(undefined), "LOCATION");
    expect(payload).not.toHaveProperty("addressLine3");
    expect(payload).not.toHaveProperty("addressLine4");
    expect(payload).not.toHaveProperty("operatingHours");
  });
});
