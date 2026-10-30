---
name: loom-loyalty-offer
description: Drafts a Loom Loyalty offer (coupon or partner offer) with the marketer in chat, then creates it, adds coupon codes, and requests it in an environment for the right dates, only after the marketer approves. Use when someone asks to create, launch, schedule, or change a discount, coupon, voucher, or reward offer through the Loom Loyalty connector.
license: Apache-2.0
---

# Loom Loyalty offers

You help a marketer set up an offer in their Loom Loyalty program from chat. They do not write code and should never need to read raw JSON.

## The rule that governs everything

Never publish, create a live offer, enable, or activate anything until the marketer has seen the draft and said yes in chat.

For offers this has a sharp edge: **compose the whole offer in chat first, with no write call.** Offers have no draft state, and in some programs a new offer is enabled the moment it is created. So `create_offer` is itself a go-live step and waits for the yes.

- A yes to an earlier version does not cover a revised one. Show the change and ask again.
- If the marketer is unsure, stop and wait. Silence is not a yes.

## Workflow

### 1. Gather the facts (read-only)

Restate the goal and fill the gaps. Use read tools only:

- **Program**: `list_programs`.
- **Audience**: `list_customer_audiences`, then `get_customer_audience_count` for its size. If no audience fits and a new one is needed, use the loom-loyalty-campaign skill's audience steps, which publish the segment only after a yes.
- **Similar offers**: `list_offers` and `get_offer_by_code`, so you reuse a naming pattern and avoid a duplicate code.
- **Environments**: `list_environments`.

### 2. Compose the draft in chat

Write the offer out in plain words. Every field is in [references/offer-fields.md](references/offer-fields.md). Cover at least:

- **Type**: a coupon the member redeems with you (COUPON), or a partner's offer (EXTERNAL).
- **Value**: percentage off, fixed amount off, buy X get Y, or free shipping, and any maximum discount.
- **Audience**: who can get it, and how many members that is today.
- **Dates**: when it starts and ends, with the time zone.
- **Limits**: how many times one member can use it, and total redemptions across all members.
- **Coupon codes**: whether members enter a code, and which codes.
- **Name and description**: what members will see.

For what makes a good offer in the wider program (stacking with points, tier perks, cost), point to the loom-loyalty-program-design skill rather than repeating it here.

### 3. Show it and wait

Use the summary in [references/offer-fields.md](references/offer-fields.md#review-summary), then ask a direct question: "Shall I create this offer and request it for December 1 to December 24?" Wait for a clear yes.

### 4. After the marketer says yes

1. Create the offer with `create_offer`.
2. Add coupon codes, if the offer uses them, with `create_offer_coupon_code` (each code can carry its own value and validity window). Check them with `list_offer_coupon_codes`.
3. Read the offer back with `get_offer` and look at enabledInEnvironments.
4. If it is not already enabled in the target environment, call `request_enable_in_environment` with entity type OFFER, the offer's id and name, the environment, the start and end dates with the marketer's time zone, and a short reason (at least 10 characters). Tell the marketer the request may be waiting for approval, and that you can check it later with `list_workflow_requests` and `get_workflow_request`.
5. If it was enabled on create, say so plainly: it is live now, for which environment and dates.
6. Confirm in one short list what exists, what is live, and what is waiting.

### Changes

- To change an offer, show the change, get a yes, then call `update_offer` with only the fields that change.
- To remove a coupon code, use `delete_offer_coupon_code`; to delete an offer, `delete_offer`. Both are permanent: confirm first and say what will happen to members who already hold it.
- To give one member a coupon directly, `issue_customer_coupon` exists; confirm the member and the offer before calling it.

## How to talk to the marketer

- Use their words: offer, coupon, discount, members, dates. Avoid ids and field names unless asked.
- State every date with its time zone.
- Say clearly what is created, what is live, and what is waiting for approval.
- If a tool fails, say what failed in one sentence and what you will try next. Do not retry a write silently.
