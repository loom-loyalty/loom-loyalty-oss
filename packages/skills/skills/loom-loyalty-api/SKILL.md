---
name: loom-loyalty-api
description: How to call the Loom Loyalty REST API correctly. Covers API keys and bearer auth, the response envelope and error codes, zero-based pagination, rate limits and backoff, deduplicating events and webhook deliveries, webhook setup and signatures, and the `@loom-loyalty/sdk` client. Use when writing or debugging code that integrates with https://api.loomloyalty.com.
license: Apache-2.0
---

# Loom Loyalty API

Base URL: `https://api.loomloyalty.com`. Reference: https://docs.loomloyalty.com (API Reference section). Every request is JSON over HTTPS with a bearer token.

For how to model a program (tiers, currencies, event rules, flows, offers), see the loom-loyalty-program-design skill. For managing configuration from a file, see the loom-loyalty-treadle skill. This skill is about calling the API.

## Authenticate

```bash
curl https://api.loomloyalty.com/customers \
  -H "Authorization: Bearer $LOOM_API_KEY"
```

- Integrations use an **API key**: `llk_<keyId>_<secret>`. Create one in the dashboard under Developers, API Keys. The secret is shown once; if it is lost, revoke the key and create another.
- `llk_<keyId>` is the public identifier and safe to log. The full value is the secret.
- Server-side only. Never ship a key in a browser, mobile app or public repository.
- Scope a key with roles so each integration gets the least access it needs. Rotate periodically and revoke on exposure.
- `401`: no valid token. `403`: valid token, missing permission for this operation. Check the key's roles before anything else.
- Read keys from the environment (`process.env.LOOM_API_KEY`). Do not write a key into code, tests or commit messages.

Each key acts within one environment of an organization. Test integrations against a development environment before production; the same endpoints exist in each. Details: [environments and keys](references/environments-and-auth.md).

## Responses and errors

Every response uses an envelope. Success puts the result under `data`:

```json
{ "success": true, "eventId": "...", "eventDateTime": "...", "data": { "customerId": "..." } }
```

Failure sets `success: false` and an `errors` array: `{ "errors": [{ "code": 1001, "message": "..." }] }`. Check the HTTP status first, then `errors[0].message`. Log `errors[0].code`; branch on the code, never on the message text. Rate-limit, overload and billing errors also set `errors[0].description` to `RATE_LIMITED`, `SERVICE_OVERLOADED` or `PAYMENT_REQUIRED`.

| Status | Meaning                                                                        | Retry?                                |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------- |
| 400    | Invalid input                                                                  | No. Fix the request                   |
| 401    | Missing or invalid credentials                                                 | No                                    |
| 402    | Billing lapsed; writes refused, reads still work                               | No. The organization must fix billing |
| 403    | Not permitted                                                                  | No. Check roles                       |
| 404    | Not found or not visible to this key                                           | No                                    |
| 409    | Conflicts with existing state, for example a record still referenced elsewhere | No. Resolve the state                 |
| 429    | Rate limited                                                                   | Yes, after `Retry-After`              |
| 503    | Briefly overloaded                                                             | Yes, after `Retry-After`              |
| 5xx    | Unexpected error on our side                                                   | Yes, with exponential backoff         |

More, with a handler: [errors and retries](references/errors-and-limits.md).

## Pagination

List endpoints take `page` (zero-based), `size` (default 10, maximum 100) and an optional `sort`. The page is under `data`: `content`, `totalSize`, `totalPages`, `pageable`.

```bash
curl "https://api.loomloyalty.com/customers?page=0&size=100" -H "Authorization: Bearer $LOOM_API_KEY"
```

Loop `page` from 0 until `totalPages` is reached. Use `size=100` for bulk reads and watch the rate limit while walking large collections.

## Rate limits

Limits are per environment and shared by every credential in it. They are token buckets, in six groups: operational read, operational write, events write, events read, management read, management write. `GET`, `HEAD` and `OPTIONS` count as reads; every other method counts as a write. Configuration writes have the lowest allowance, so do not bulk-import configuration in a tight loop.

On `429` or `503` read `Retry-After` (seconds), add random jitter and retry. Without the header use exponential backoff capped around 30 seconds. `429` responses also carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. Limits scale with the organization's plan; ask support@loomloyalty.com for more. Do not hard-code numbers from memory; see [errors and limits](references/errors-and-limits.md).

## Events and idempotency

Loyalty outcomes come from events: `POST /events` submits one, and the organization's event rules and flows react. Events processed by rules write to an append-only ledger, so a duplicate submission can award twice if your own retry logic resubmits after an ambiguous failure. Therefore:

- Give each business event a stable identifier on your side (an order id, for example) and record whether it was submitted. Do not resubmit on a timeout until you have looked the event up.
- Treat `eventId` as the identity of an event. `PUT /events/{eventId}` re-runs rules for an existing event with new data; use it to correct, not to resend.
- On the receiving side, deduplicate webhook deliveries on `messageId`.
- Do not retry `4xx` responses unchanged.

The public docs do not describe an `Idempotency-Key` header. Do not send one expecting protection.

## Webhooks

Register an HTTPS endpoint in the dashboard (Developers, Webhooks) or with `POST /webhooks/endpoints` (`url`, `endpointType: "CLIENT"`, `filterTypes`, optional `description`). Each delivery is a `POST` of `{ messageId, eventType, eventId, payload }`. Verify the signature with the endpoint's secret (`GET /webhooks/endpoints/{id}/secret`, rotate with `POST /webhooks/endpoints/{id}/secret/rotate`), answer `2xx` fast, and do real work asynchronously. Failed deliveries are retried. Test messages, attempt history and replay are available per endpoint. Details: [webhooks](references/webhooks.md).

## TypeScript SDK

`@loom-loyalty/sdk` wraps the API. It unwraps the envelope, so calls return `data` directly and failures throw `ApiError`.

```ts
import { LoomLoyalty, ApiError } from "@loom-loyalty/sdk";

const client = new LoomLoyalty({
  baseUrl: "https://api.loomloyalty.com",
  tokenProvider: () => process.env.LOOM_API_KEY ?? null,
});

try {
  const page = await client.customer.listCustomers({ page: 0, size: 25 });
} catch (error) {
  if (error instanceof ApiError) console.error(error.status, error.code, error.requestId);
  else throw error;
}
```

`ApiError` exposes `status`, `code`, `message`, `requestId`, and `fieldErrors` (dotted field path plus message). Log `requestId` when contacting support. React apps can use the generated TanStack Query hooks from the same package. More: [SDK notes](references/sdk.md).

## Checklist before shipping an integration

1. Key from the environment, server-side, least-privilege roles.
2. Retries only for `429`, `503` and `5xx`, honoring `Retry-After`, with jitter.
3. Pagination loops to `totalPages`, with `size` set deliberately.
4. Events submitted once per business event; webhook handler deduplicates on `messageId`.
5. Tested against a development environment first.
