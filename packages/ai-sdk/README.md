# @loom-loyalty/ai-sdk

Vercel AI SDK tools that let your storefront's shopper chat answer loyalty questions from Loom Loyalty: "How many points do I have?", "What tier am I?", "Do I have any coupons?"

The tools are read-only and scoped to one shopper. Your server decides who the shopper is and passes their id; the model can never pick a different customer.

## Install

```bash
npm install @loom-loyalty/ai-sdk ai zod
```

Works with AI SDK 5 through 7 (tested on 5 and 7).

## Set up an API key

1. In the Loom Loyalty dashboard, go to **Developers → API Keys** and create a key.
2. Open **Manage Roles** on it and leave it only a read-only role, such as **AI Bot**. The tools only read, so the key doesn't need write access.
3. Set these on your server. Never send the key to the browser.

```bash
LOOM_LOYALTY_API_URL=https://api.loomloyalty.com
LOOM_LOYALTY_API_KEY=...
```

This is a server-to-server integration. Loom Loyalty does not sign shoppers in; your app's own session says who the shopper is.

## Use it

```ts
import { memberTools } from "@loom-loyalty/ai-sdk";
import { streamText } from "ai";

export async function POST(req: Request) {
  const shopper = await getSignedInShopper(req); // your auth
  const { messages } = await req.json();

  const result = streamText({
    model: "anthropic/claude-sonnet-5.5",
    system:
      "You are the store's assistant. Use the loyalty tools for questions about points, tier and offers.",
    messages,
    tools: memberTools({ customerExternalId: shopper.id }),
  });
  return result.toUIMessageStreamResponse();
}
```

`customerExternalId` is the shopper's id in your system, as stored on their Loom Loyalty customer record (`externalId`).

## Tools

None of the tools take input. Each one reads the shopper named by `customerExternalId` and nobody else.

| Tool          | Returns                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getMyPoints` | `{ programs: [{ program, currency, available, pending }] }`                                                                                                  |
| `getMyTier`   | `{ tiers: [{ tier, nextTier? }] }`                                                                                                                           |
| `getMyOffers` | `{ offers: [{ name, code?, validFrom?, validUntil? }] }`: coupons the shopper can use now (not used, held, cancelled or expired). Times are ISO 8601 in UTC. |

## Options

| Option               | Default                |                                                             |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| `customerExternalId` | required               | The signed-in shopper's id in your system.                  |
| `apiUrl`             | `LOOM_LOYALTY_API_URL` |                                                             |
| `apiKey`             | `LOOM_LOYALTY_API_KEY` | Use a read-only key.                                        |
| `timeoutMs`          | `10000`                | Per tool call.                                              |
| `client`             |                        | A `MemberClient` to use instead of building one, for tests. |

`memberTools` throws `LoomLoyaltyConfigError` when the shopper id, URL or key is missing.

## Errors

Tools never throw. A failure comes back as `{ error }` with a fixed message the model can pass on, such as `"Member not found."` or `"Loom Loyalty is busy. Try again in a moment."`. Messages never include the API's own error text, so the key can't leak into the chat.

## Admin assistants

For staff-facing assistants that manage programs and customers, connect the Loom Loyalty MCP server instead. See the docs: [Connect AI assistants](https://docs.loomloyalty.com/guide/connect-ai-assistants).
