# SDK notes: @loom-loyalty/sdk

The package ships three entry points.

| Import                     | What                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `@loom-loyalty/sdk`        | Generated TanStack Query hooks, types, the `LoomLoyalty` class and core helpers |
| `@loom-loyalty/sdk/client` | The class-based client                                                          |
| `@loom-loyalty/sdk/core`   | Configuration and error helpers                                                 |

React hooks need peer dependencies `react` and `@tanstack/react-query` (v5). The package is published on npm.

## Class client

`new LoomLoyalty({ baseUrl, tokenProvider })`. `tokenProvider` is a function returning the token (or `null`), sync or async, called before each request. Resources are properties named for the API area, for example `client.customer`, `client.eventEngine`, `client.programManagement`. Methods are named for the operation: `listCustomers`, `createCustomer`, `getCustomer`, `publishEvent`.

Calls return the envelope's `data`. List calls take the usual query parameters: `listCustomers({ page: 0, size: 100 })`.

## Hooks

Generated hooks are named `use<Tag><Operation>`. Find the hook for an operation in the package's type definitions instead of guessing the name. Mutations use `mutateAsync`:

```ts
await mutation.mutateAsync({ id, data });
```

Configure the base URL and token once at startup with `setApiBaseUrl(url)` and `setTokenProvider(() => token)` from `@loom-loyalty/sdk`.

## Concurrent servers

`setTokenProvider` keeps module-level state. A server handling requests for different users at once must not use it, or tokens can cross between requests. Use `runWithSdkContext({ baseUrl, tokenProvider }, fn)` so each request reads its own context. Plain scripts and single-credential integrations can use the class client.

## Errors

Failed calls throw `ApiError`:

| Field         | Meaning                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------- |
| `status`      | HTTP status                                                                                   |
| `code`        | Stable catalog code such as `CUSTOMER_ALREADY_MERGED`, or the legacy numeric code as a string |
| `message`     | User-safe message                                                                             |
| `requestId`   | Include this when contacting support                                                          |
| `fieldErrors` | List of `{ field, code?, message }`, with dotted field paths like `address.postcode`          |

Helpers: `getErrorCode`, `getFieldErrors`, `getRequestId`, `isApiErrorCode`. The error reader accepts both RFC 9457 problem-details bodies and the older `success`/`errors` envelope.

## Do not

- Edit generated code by hand. Regenerate from the OpenAPI spec instead.
- Add raw `fetch` calls next to the SDK for operations it already covers.
