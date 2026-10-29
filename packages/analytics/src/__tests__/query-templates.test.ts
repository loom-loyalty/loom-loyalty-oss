import { describe, expect, it } from "vitest";
import { QUERY_TEMPLATES } from "../query-templates";

describe("Query Templates", () => {
  it("has templates defined", () => {
    expect(QUERY_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("all templates have required fields", () => {
    for (const t of QUERY_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.sql).toBeTruthy();
      expect(t.datasource).toBeTruthy();
    }
  });

  it("all template names are non-empty strings", () => {
    for (const t of QUERY_TEMPLATES) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
    }
  });

  it("all template descriptions are non-empty strings", () => {
    for (const t of QUERY_TEMPLATES) {
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("all templates have valid SQL starting with SELECT", () => {
    for (const t of QUERY_TEMPLATES) {
      expect(t.sql.trim().toUpperCase()).toMatch(/^SELECT/);
    }
  });

  it("all template SQL references the declared datasource", () => {
    for (const t of QUERY_TEMPLATES) {
      expect(t.sql).toContain(t.datasource);
    }
  });

  it("has templates for mv_events", () => {
    const eventTemplates = QUERY_TEMPLATES.filter((t) => t.datasource === "mv_events");
    expect(eventTemplates.length).toBeGreaterThanOrEqual(1);
  });

  it("has templates for mv_customers", () => {
    const customerTemplates = QUERY_TEMPLATES.filter((t) => t.datasource === "mv_customers");
    expect(customerTemplates.length).toBeGreaterThanOrEqual(1);
  });

  it("has no duplicate template names", () => {
    const names = QUERY_TEMPLATES.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all template datasources are recognized", () => {
    const knownDatasources = new Set(["mv_events", "mv_customers"]);
    for (const t of QUERY_TEMPLATES) {
      expect(knownDatasources.has(t.datasource)).toBe(true);
    }
  });
});
