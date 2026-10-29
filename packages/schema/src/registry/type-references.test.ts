import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetResolvedTypeReferenceWarnings, resolveTypeReference } from "./type-references.js";

describe("[audit] resolveTypeReference", () => {
  beforeEach(() => {
    __resetResolvedTypeReferenceWarnings();
  });

  it.each([
    ["STRING", "string"],
    ["TEXT", "text"],
    ["INTEGER", "integer"],
    ["DECIMAL", "number"],
    ["NUMBER", "number"],
    ["BOOLEAN", "boolean"],
    ["DATE", "date"],
    ["DATE_TIME", "datetime"],
    ["TIME", "time"],
    ["EMAIL", "email"],
    ["URL", "url"],
    ["UUID", "uuid"],
    ["JSON", "json"],
    ["ARRAY", "array"],
    ["OBJECT", "object"],
  ])("preserves direct mapping for %s → %s", (typeRef, expected) => {
    expect(resolveTypeReference(typeRef).type).toBe(expected);
  });

  it("maps LOCALIZED_STRING to localized_string (no longer flattened to string)", () => {
    expect(resolveTypeReference("LOCALIZED_STRING").type).toBe("localized_string");
  });

  it("maps ENTITY_ID to reference (no longer flattened to string)", () => {
    expect(resolveTypeReference("ENTITY_ID").type).toBe("reference");
  });

  it("maps METADATA to metadata (no longer flattened to string)", () => {
    expect(resolveTypeReference("METADATA").type).toBe("metadata");
  });

  it("maps FIAT_CURRENCY to fiat_currency rather than flattening its composite value", () => {
    expect(resolveTypeReference("FIAT_CURRENCY").type).toBe("fiat_currency");
  });

  it.each(["fiat-currency", "FIAT-CURRENCY", "Fiat-Currency"])(
    "normalizes hyphenated FIAT_CURRENCY variants before resolving %s",
    (typeRef) => {
      expect(resolveTypeReference(typeRef)).toEqual({
        type: "fiat_currency",
        originalTypeReference: "FIAT_CURRENCY",
      });
    }
  );

  it("normalizes hyphenated composite codes before falling back", () => {
    expect(resolveTypeReference("transaction-line-item")).toEqual({
      type: "string",
      originalTypeReference: "TRANSACTION_LINE_ITEM",
    });
  });

  it.each([
    "DATE_TIME_PERIOD",
    "DURATION_PERIOD_VALUE",
    "COORDINATES",
    "TIME_ZONE",
    "DATA_TYPE",
    "METADATA_TYPE",
    "METADATA_GROUP",
    "CODE_GEN_INFORMATION",
    "CUSTOMER_AUDIENCE",
    "ENABLED_IN_ENVIRONMENT",
    "OFFER",
  ])("preserves originalTypeReference on fall-through %s", (typeRef) => {
    const resolved = resolveTypeReference(typeRef);
    expect(resolved.type).toBe("string");
    expect(resolved.originalTypeReference).toBe(typeRef);
  });

  it("preserves originalTypeReference for known types too", () => {
    expect(resolveTypeReference("LOCALIZED_STRING").originalTypeReference).toBe("LOCALIZED_STRING");
  });

  it("warns once per unmapped typeReference (subsequent calls suppressed)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    resolveTypeReference("MYSTERY_TYPE");
    resolveTypeReference("MYSTERY_TYPE");
    resolveTypeReference("MYSTERY_TYPE");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("[audit] registry public API surface", () => {
  it("does not re-export __resetResolvedTypeReferenceWarnings from registry barrel", async () => {
    const barrel = await import("./index.js");
    expect(barrel).not.toHaveProperty("__resetResolvedTypeReferenceWarnings");
  });

  it("still exposes resolveTypeReference and ResolvedTypeReference type from the barrel", async () => {
    const barrel = await import("./index.js");
    expect(barrel).toHaveProperty("resolveTypeReference");
  });
});
