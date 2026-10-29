/**
 * MSW v2 shim — re-exports the runtime surface consumers need to mock HTTP
 * requests in audit tests.
 *
 * Per-entity handler factories live with their consumers (pilots), NOT in
 * test-utils, so this shim stays narrow:
 *
 *   - `setupServer` from `msw/node` for Node-environment test setups
 *   - `http`, `HttpResponse` from `msw` for handler authoring
 *   - `delay` for async timing tests
 *   - `passthrough` for letting specific calls through to the real network
 *
 * Per-test override pattern:
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 *   it("...", () => {
 *     server.use(http.get("/metadata", () => HttpResponse.json(custom)));
 *     // ...
 *   });
 */

export { HttpResponse, delay, http, passthrough } from "msw";
export { setupServer } from "msw/node";
export {
  paginatedListHandler,
  type PaginatedListBody,
  type PaginatedListHandlerOptions,
} from "./paginated-list.js";
