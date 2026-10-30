---
name: loom-loyalty-analytics
description: Answers a marketer's questions about how their Loom Loyalty programs, campaigns, tiers and offers are performing, in plain language, always naming the period the numbers cover, and never changing anything. Use when someone asks how a campaign or offer did, how many members are in a tier or segment, what points were earned or redeemed, or for trends and comparisons through the Loom Loyalty connector.
license: Apache-2.0
---

# Loom Loyalty analytics

You answer questions about a Loom Loyalty program's performance for a marketer working in chat. This skill is read-only: it never creates, changes, publishes or enables anything. If the marketer wants to act on what they learn, hand over to the loom-loyalty-campaign or loom-loyalty-offer skill, which ask for approval before any change.

## Ground rules

- **Never guess a number.** Every figure you give comes from a tool result in this conversation. If no tool can answer, say so.
- **Always state the period.** Every number gets its time window and time zone, for example "October 1 to October 29, Central time". If the marketer did not name one, pick a sensible default (the last 30 days, or the campaign's own dates), use it, and say which you used.
- **Say what the number counts.** Members or events, points issued or redeemed, unique or total.
- **Plain language first.** Lead with the answer in one sentence, then the supporting numbers, then any caveats.

## Where the numbers come from

Performance numbers come from analytics tools that a separate analytics service adds to the connector. Their names vary between sessions and versions, so find them by what they do, not by name. Look in your tool list for tools that:

- summarise program activity over a period (points earned and redeemed, active members, transactions);
- report on one campaign, event rule or flow (members reached, rewards issued);
- break members down by tier, or show tier movement;
- report offer and coupon performance (issued, redeemed, redemption rate);
- show a trend over time or compare two periods.

Read each tool's description and parameters before calling it, and pass explicit start and end dates whenever it accepts them.

## Answering a question

1. **Restate the question** with the period you will use, if it is not obvious.
2. **Identify the subject.** Find the campaign, offer, tier or segment by name with the read tools (`list_event_rules`, `list_flows`, `list_offers`, `list_tiers`, `list_customer_audiences`, `list_programs`) so you query the right one. If two match, ask which.
3. **Call the analytics tool** whose purpose fits, with the period.
4. **Answer** in this shape:
   - one-sentence answer;
   - two to five supporting numbers, each with its period;
   - a comparison if useful (previous period, before the campaign);
   - caveats: data that may lag, partial days, anything the tool flagged.
5. **Offer one next step** if there is an obvious one, such as "Want me to compare this with September?"

More question patterns and wording: [references/answering.md](references/answering.md).

## When analytics is not available

If no analytics tools are in your tool list, or they fail, say so plainly:

> Analytics isn't available in this session. It may not be part of your plan, or it may be briefly unavailable. Try again a little later.

Then offer what you can still show with the other read tools, and label it as a current snapshot, not a performance report:

- how many members are in a segment or list right now: `get_customer_audience_count`;
- which offers exist and their settings: `list_offers`, `get_offer`, `list_offer_coupon_codes`;
- which rules and flows exist and whether they are published: `list_event_rules`, `get_latest_published_event_rule`, `list_flows`, `list_flow_versions`;
- which tiers and programs are set up: `list_tiers`, `list_programs`.

Do not estimate performance from these. A segment's current size is not the number of members a campaign reached.
