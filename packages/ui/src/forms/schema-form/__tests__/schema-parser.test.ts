import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getSchemaDefaults, parseSchema } from "../schema-parser";

describe("schema-parser", () => {
  describe("parseSchema", () => {
    it("parses literal defaults", () => {
      const schema = z.object({
        name: z.string().default("hello"),
        count: z.number().default(42),
        active: z.boolean().default(true),
      });

      const fields = parseSchema(schema);

      expect(fields.find((f) => f.name === "name")?.defaultValue).toBe("hello");
      expect(fields.find((f) => f.name === "count")?.defaultValue).toBe(42);
      expect(fields.find((f) => f.name === "active")?.defaultValue).toBe(true);
    });

    it("parses factory function defaults", () => {
      const schema = z.object({
        config: z.object({ key: z.string() }).default(() => ({ key: "val" })),
        tags: z.array(z.string()).default(() => ["a", "b"]),
      });

      const fields = parseSchema(schema);

      const configDefault = fields.find((f) => f.name === "config")?.defaultValue;
      expect(configDefault).toEqual({ key: "val" });
      expect(typeof configDefault).not.toBe("function");

      const tagsDefault = fields.find((f) => f.name === "tags")?.defaultValue;
      expect(tagsDefault).toEqual(["a", "b"]);
      expect(typeof tagsDefault).not.toBe("function");
    });

    it("parses optional + default combos", () => {
      const schema = z.object({
        nickname: z.string().optional().default("anon"),
      });

      const fields = parseSchema(schema);
      const field = fields.find((f) => f.name === "nickname");

      expect(field?.defaultValue).toBe("anon");
      expect(field?.required).toBe(false);
    });

    it("parses nested wrappers (optional -> default -> nullable)", () => {
      const schema = z.object({
        notes: z.string().nullable().default("none").optional(),
      });

      const fields = parseSchema(schema);
      const field = fields.find((f) => f.name === "notes");

      expect(field?.defaultValue).toBe("none");
      expect(field?.required).toBe(false);
    });

    it("marks fields without defaults as required", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        defaulted: z.string().default("x"),
      });

      const fields = parseSchema(schema);

      expect(fields.find((f) => f.name === "required")?.required).toBe(true);
      expect(fields.find((f) => f.name === "optional")?.required).toBe(false);
      expect(fields.find((f) => f.name === "defaulted")?.required).toBe(false);
    });
  });

  describe("getSchemaDefaults", () => {
    it("returns literal defaults", () => {
      const schema = z.object({
        name: z.string().default("hello"),
        age: z.number(),
      });

      const defaults = getSchemaDefaults(schema);

      expect(defaults).toEqual({ name: "hello" });
    });

    it("invokes factory function defaults", () => {
      const schema = z.object({
        items: z.array(z.string()).default(() => ["x"]),
        label: z.string(),
      });

      const defaults = getSchemaDefaults(schema);

      expect(defaults).toEqual({ items: ["x"] });
      expect(typeof defaults.items).not.toBe("function");
    });
  });
});
