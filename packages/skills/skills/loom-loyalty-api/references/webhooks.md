# Webhooks

Webhooks push signed notifications to your system when events happen in the program, so you do not poll.

## Create an endpoint

Dashboard: Developers, Webhooks. Or the API:

```bash
curl -X POST https://api.loomloyalty.com/webhooks/endpoints \
  -H "Authorization: Bearer $LOOM_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/hooks/loom-loyalty",
    "endpointType": "CLIENT",
    "filterTypes": ["<event type>"],
    "description": "Order service"
  }'
```

| Field          | Required | Meaning                                     |
| -------------- | -------- | ------------------------------------------- |
| `url`          | yes      | HTTPS destination                           |
| `endpointType` | yes      | `CLIENT` for a customer-configured endpoint |
| `filterTypes`  | yes      | Event types this endpoint receives          |
| `description`  | no       | Label                                       |

Listing endpoints is paginated like any list: `GET /webhooks/endpoints?page=0&size=25`.

## A delivery

A `POST` to your `url`:

```json
{ "messageId": "...", "eventType": "...", "eventId": "...", "payload": {} }
```

- `eventType` says what happened; `payload` has the details.
- `messageId` is unique per webhook message. Deduplicate on it so a redelivery is processed once.
- `eventId`, when present, is the caller-supplied id for correlation. One event can produce several messages, so don't deduplicate on it.
- Reply `2xx` quickly. Failed or timed-out deliveries are retried, so queue the real work.

## Signatures

Each endpoint has a signing secret: read it with `GET /webhooks/endpoints/{id}/secret`, rotate it with `POST /webhooks/endpoints/{id}/secret/rotate`. Verify every delivery with it before trusting the body, and rotate if it is exposed. The exact header names and algorithm are in the API Reference at https://docs.loomloyalty.com; read them there before writing verification code and do not guess.

## Debugging

- Test messages: send a sample delivery to an endpoint (`/webhooks/endpoints/{endpointId}/test-messages`).
- Attempts: inspect each delivery attempt and its response.
- Recoveries: replay messages after an outage.

## Connectors

To deliver into a downstream tool without writing a receiver, apply a connector (`connectorKind`) to the endpoint. Use `CUSTOM` for raw, untransformed delivery.
