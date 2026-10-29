import { describe, expect, it } from "vitest";

import breakPolymorphicCycles from "./break-polymorphic-cycles.mjs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

describe("breakPolymorphicCycles", () => {
  it("inlines the parent's properties in place of a subtype's back-reference", () => {
    const spec = {
      components: {
        schemas: {
          Destination: {
            type: "object",
            properties: { destinationType: { type: "string" } },
            oneOf: [ref("S3Destination")],
          },
          S3Destination: {
            type: "object",
            allOf: [
              ref("Destination"),
              { type: "object", properties: { bucket: { type: "string" } } },
            ],
          },
        },
      },
    };

    const s3 = breakPolymorphicCycles(spec).components.schemas.S3Destination;

    expect(s3.allOf[0]).toEqual({
      type: "object",
      properties: { destinationType: { type: "string" } },
    });
    expect(s3.allOf[1].properties.bucket).toEqual({ type: "string" });
  });

  it("leaves an allOf to a parent without oneOf untouched", () => {
    const spec = {
      components: {
        schemas: {
          Base: { type: "object", properties: { id: { type: "string" } } },
          Child: { allOf: [ref("Base"), { type: "object" }] },
        },
      },
    };

    expect(breakPolymorphicCycles(spec).components.schemas.Child.allOf[0]).toEqual(ref("Base"));
  });
});
