import { describe, expect, it } from "vitest";

import dropErrorResponseBodies from "./drop-error-response-bodies.mjs";

const problem = { "application/json": { schema: { $ref: "#/components/schemas/ProblemDetail" } } };

describe("dropErrorResponseBodies", () => {
  it("keeps success bodies and drops error bodies, keeping the error codes", () => {
    const spec = {
      paths: {
        "/organizations/{id}": {
          parameters: [{ name: "id", in: "path" }],
          get: {
            responses: {
              200: { description: "OK", content: { "application/json": { schema: {} } } },
              "404": { description: "Not found", content: problem },
              default: { description: "Error", content: problem },
            },
          },
        },
      },
    };

    const responses = dropErrorResponseBodies(spec).paths["/organizations/{id}"].get.responses;

    expect(responses[200].content).toBeDefined();
    expect(responses["404"]).toEqual({ description: "Not found" });
    expect(responses.default).toEqual({ description: "Error" });
  });

  it("tolerates a spec with no paths", () => {
    expect(dropErrorResponseBodies({})).toEqual({});
  });
});
