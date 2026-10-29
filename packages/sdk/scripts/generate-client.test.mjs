import { describe, expect, it } from "vitest";

import {
  generateResourceClass,
  getResponseType,
  getUnwrappedType,
  resourceFileName,
  toCamelCase,
} from "./generate-client.mjs";

describe("slash-separated tags", () => {
  it("uses a filesystem-safe resource file while preserving existing tag behavior", () => {
    expect(resourceFileName("admin/feature-flags")).toBe("admin-feature-flags");
    expect(resourceFileName("feature-flags")).toBe("feature-flags");
    expect(toCamelCase("admin/feature-flags")).toBe("adminFeatureFlags");
    expect(toCamelCase("feature-flags")).toBe("featureFlags");
    expect(generateResourceClass("admin/feature-flags", [])).toContain(
      "export class AdminFeatureFlagsResource"
    );
  });
});

describe("getUnwrappedType", () => {
  // Regression: ResponsePortalConfig's own name is stale (predates a rename),
  // but its `data` field correctly points at RewardsPortalConfig. The old
  // name-slice heuristic ("ResponsePortalConfig".slice(8)) produced the
  // nonexistent "PortalConfig" instead.
  it("resolves a Response* wrapper via its data $ref, not by slicing the wrapper's own name", () => {
    const schemas = {
      ResponsePortalConfig: {
        type: "object",
        properties: { data: { $ref: "#/components/schemas/RewardsPortalConfig" } },
      },
    };
    expect(getUnwrappedType("ResponsePortalConfig", schemas)).toBe("RewardsPortalConfig");
  });

  it("unwraps a Response<List<X>> wrapper to an array of its item type", () => {
    const schemas = {
      ResponseListAgreementAcceptance: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/AgreementAcceptance" } },
        },
      },
    };
    expect(getUnwrappedType("ResponseListAgreementAcceptance", schemas)).toBe(
      "AgreementAcceptance[]"
    );
  });

  it("falls back to slicing the wrapper name when data has no direct $ref (e.g. a oneOf wrapper)", () => {
    const schemas = {
      ResponseOffer: {
        type: "object",
        properties: {
          data: {
            oneOf: [
              { $ref: "#/components/schemas/Offer" },
              { $ref: "#/components/schemas/CouponOffer" },
            ],
          },
        },
      },
    };
    expect(getUnwrappedType("ResponseOffer", schemas)).toBe("Offer");
  });

  it("falls back to slicing the wrapper name when no schemas map is provided at all", () => {
    expect(getUnwrappedType("ResponseOrganization", undefined)).toBe("Organization");
  });

  it("returns void when the resolved inner type is a bare/invalid name", () => {
    const schemas = {
      ResponseVoid: {
        type: "object",
        properties: { data: { $ref: "#/components/schemas/Void" } },
      },
    };
    expect(getUnwrappedType("ResponseVoid", schemas)).toBe("void");
  });

  it("returns void for an empty or missing type name", () => {
    expect(getUnwrappedType("", {})).toBe("void");
    expect(getUnwrappedType(undefined, {})).toBe("void");
  });

  it("still unwraps Paged*/List* wrappers unchanged (schemas param only affects Response*)", () => {
    expect(getUnwrappedType("PagedOrganization", {})).toBe("PagedOrganizationData");
    expect(getUnwrappedType("ListOrganization", {})).toBe("Organization[]");
    expect(getUnwrappedType("ListResponseMessageOut", {})).toBe("ListResponseMessageOut");
  });
});

describe("getResponseType", () => {
  it("types a bare array response by its item schema", () => {
    expect(
      getResponseType(
        { type: "array", items: { $ref: "#/components/schemas/FeatureFlagTarget" } },
        {}
      )
    ).toBe("FeatureFlagTarget[]");
  });

  it("keeps void for responses without a schema reference", () => {
    expect(getResponseType(undefined, {})).toBe("void");
    expect(getResponseType({ type: "array", items: { type: "string" } }, {})).toBe("void");
  });
});
