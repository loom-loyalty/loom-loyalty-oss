/**
 * Orval input transformer: drops the body schema from every non-2xx response.
 *
 * The platform documents its 4xx/5xx answers as `ProblemDetail`. Orval folds every documented
 * response into the generated function's return type, so `response.data` would become
 * `Entity | ProblemDetail` everywhere. `sdkFetch` never returns a non-2xx answer: it throws an
 * `ApiError` carrying the problem detail instead. Keeping only the success bodies makes the
 * generated types say what callers actually receive. The response codes and descriptions stay.
 */
export default function dropErrorResponseBodies(spec) {
  for (const pathItem of Object.values(spec?.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      const responses = operation?.responses;
      if (!responses || typeof responses !== "object") continue;
      for (const [code, response] of Object.entries(responses)) {
        if (/^2/.test(code) || !response?.content) continue;
        delete response.content;
      }
    }
  }
  return spec;
}
