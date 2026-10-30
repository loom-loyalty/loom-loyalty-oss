# Errors, retries and rate limits

## Handling a response

```ts
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.LOOM_API_KEY}` },
});
const body = await response.json();

if (!response.ok || body.success === false) {
  const err = body.errors?.[0];
  throw new Error(
    `Loom Loyalty API ${response.status} [${err?.code}]: ${err?.message ?? response.statusText}`
  );
}
return body.data;
```

- Any non-2xx status, or `success: false`, is a failure.
- `errors[0].code` is stable enough to branch on. `message` is for humans.
- `description` (`RATE_LIMITED`, `SERVICE_OVERLOADED`, `PAYMENT_REQUIRED`) is a stable reason for those three cases.
- Retry `429`, `503` and `5xx` with backoff. Never retry other `4xx` without changing the request.
- Do not retry `402`. It fails until someone fixes the organization's billing. Reads continue to work.

## Rate limit model

Each environment has its own allowance, shared by all credentials. A limit is a token bucket: it refills at a sustained rate per second, and its burst is the most requests it can hold for a spike. An idle bucket refills to its burst.

Buckets: operational read, operational write, events write, events read, management read, management write. Reads are `GET`, `HEAD`, `OPTIONS`; everything else is a write. Day-to-day customer operations and event submission have the highest allowances; configuration writes the lowest. Some endpoints, such as search, keep an extra tighter limit.

Allowances depend on the organization's plan, and development environments get a reduced share of production's. The current numbers are on the Rate Limits page at https://docs.loomloyalty.com, so read them there rather than caching figures in code. No limit drops below 5 requests per second with a burst of 20.

## 429 headers

| Header                  | Meaning                                |
| ----------------------- | -------------------------------------- |
| `Retry-After`           | Seconds to wait. At least 1            |
| `X-RateLimit-Limit`     | Bucket capacity (its burst)            |
| `X-RateLimit-Remaining` | Requests left                          |
| `X-RateLimit-Reset`     | Seconds until the bucket is full again |

A `503` (`SERVICE_OVERLOADED`) means the platform was briefly too busy to start the request. It does not use up rate limit; retry it the same way.

## Backoff helper

```ts
async function requestWithBackoff(url: string, options: RequestInit, maxRetries = 5) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options);
    const retryable = response.status === 429 || response.status === 503;
    if (!retryable || attempt === maxRetries) return response;

    const retryAfter = Number(response.headers.get("Retry-After"));
    const base =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : Math.min(2 ** attempt, 30);
    await new Promise((r) => setTimeout(r, (base + Math.random() * base * 0.5) * 1000));
  }
}
```

Only wrap requests that are safe to repeat. For `POST /events`, see the idempotency guidance in the main skill before adding automatic retries.

## Reducing load

Cache slow-changing reads, page with `size=100` for bulk, spread bulk jobs over time, and slow down when `X-RateLimit-Remaining` is low.
