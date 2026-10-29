/**
 * Orval input transformer: breaks parent <-> subtype cycles in polymorphic schemas.
 *
 * A discriminated parent lists its subtypes in `oneOf`, and the API's spec also gives each
 * subtype an `allOf` back to that parent (the subtype extends the parent server-side). Orval renders that as `Parent = A | B` and
 * `A = Omit<Parent & AAllOf, ...>`, which TypeScript rejects ("circularly references itself").
 *
 * For each subtype whose `allOf` refers back to a `oneOf` parent that lists it, the parent `$ref`
 * is replaced with the parent's own `properties` and `required`, so the subtype keeps every field
 * and the parent stays the union.
 */
export default function breakPolymorphicCycles(spec) {
  const schemas = spec?.components?.schemas;
  if (!schemas) return spec;

  const refName = (ref) => (typeof ref === "string" ? ref.split("/").pop() : undefined);

  for (const [parentName, parent] of Object.entries(schemas)) {
    if (!Array.isArray(parent?.oneOf)) continue;
    const subtypes = new Set(parent.oneOf.map((entry) => refName(entry?.$ref)).filter(Boolean));

    for (const subtypeName of subtypes) {
      const subtype = schemas[subtypeName];
      if (!Array.isArray(subtype?.allOf)) continue;
      const backRef = subtype.allOf.findIndex((entry) => refName(entry?.$ref) === parentName);
      if (backRef === -1) continue;

      const inlined = { type: "object" };
      if (parent.properties) inlined.properties = parent.properties;
      if (parent.required) inlined.required = parent.required;
      subtype.allOf.splice(backRef, 1, inlined);
    }
  }
  return spec;
}
