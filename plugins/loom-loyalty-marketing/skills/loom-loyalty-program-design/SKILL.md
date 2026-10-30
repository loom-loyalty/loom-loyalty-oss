---
name: loom-loyalty-program-design
description: Guidance for modelling a Loom Loyalty program well: tiers, currencies, event rules, flows, offers, targets and audiences, when to choose an event rule or a flow, and common pitfalls such as tier-specific multipliers. Use when designing or reviewing loyalty program structure or rules, before writing config, API calls or a treadle file.
license: Apache-2.0
---

# Designing a Loom Loyalty program

This skill is about what to build. For the file format and CLI, see the loom-loyalty-treadle skill. For calling the API, see the loom-loyalty-api skill.

## The model in one pass

- **Program**: the container customers earn and spend within. Currencies, tiers, offers, targets and rules are configured per program.
- **Program currency**: the unit awarded and tracked (points, miles, stars, cash-back). A program can have several.
- **Tier**: a ranked membership level. Lower rank number is higher status; rank 1 is the top tier.
- **Event**: a signal you send ("a customer did something"). **Event rule**: turns one event into outcomes (award currency, issue a tier, count toward a target, grant a badge).
- **Flow**: a versioned multi-step journey with waits and branches that remembers each customer's place.
- **Target**: a goal or counter customers progress toward. **Badge**: an achievement.
- **Offer**: something you give customers; coupon offers carry codes. **Audience**: a named group (a fixed list or a rule-built segment).
- **Ledger**: the append-only history behind every balance. It is the source of truth and the audit trail.

The pipeline: configure, enroll customers, send events, rules apply and write to the ledger, balances, targets, badges and tiers update. Everything is readable back through the API.

## Event rule or flow

Answer in order; the first yes decides.

1. Must something happen later than the event itself ("wait 7 days", "wait until they purchase")? **Flow.**
2. Does the next step depend on what the customer does after the first step? **Flow.**
3. Are you starting a journey for a group or audience, not reacting to one customer's event? **Flow.**
4. Otherwise: **event rule.** One event, one immediate action. Simpler to build and test.

Several event rules that only make sense together (one issues an offer, another rewards its use) is a sign they belong in one flow. Flows replaced the older campaigns feature. More: [rules and flows](references/rules-and-flows.md).

## Design order

1. **Program and currency.** Decide the currency first. Decide expiry and pending policy now: a currency follows only the expiry or pending rule it is linked to, and patching policy in after customers hold balances is painful.
2. **Tiers.** Set rank, how customers enter (a rule that issues the tier), whether it lasts (duration) and what it drops to (downgrade tier). See [tiers and currencies](references/tiers-and-currencies.md).
3. **Event types.** One per distinct thing that happens. Name them for the business event, not the screen.
4. **Base earning rule**, then promotions and tier bonuses on top.
5. **Targets and badges** for goals and limits. Decide per counter whether it is a goal or a cap, and which rules count toward it. See [targets](references/targets.md).
6. **Offers and audiences**, then flows that use them.
7. Backtest rule changes against past events before publishing.

## Tier-specific earning: the known trap

A `currentTier` condition contributes no actions of its own. A rule whose only structure is a tier check will match and do nothing. For a tier-specific multiplier, put the actions on an `and` node whose children include the tier condition:

```yaml
eventActionsExpression:
  and:
    children:
      - currentTier:
          tierCode: gold
          revalidateTier: true
    actions:
      - issueProgramCurrency:
          programCode: cafe-rewards
          programCurrencyCode: beans
          # bonus on top of the base award: for +20%, multiply the amount by 0.2
          path: $.eventData.amount
          preOperation:
            multiply:
              operand: 0.2
          synchronous: false
```

Rules of thumb for tier bonuses:

- Express a bonus as the extra portion (`multiplier - 1`) when a base rule already awards the standard rate, or the customer is paid twice.
- Make one rule per tier bonus, each gated on its own tier, so a plan diff shows exactly which tier changed.
- Skip tiers whose multiplier is 1 or less. A multiplier under 1 as a "bonus" would subtract.
- Test with a customer in each tier. A tier-gated rule that never fires looks identical to a working one until someone checks a balance.

## Pitfalls

- **Rule with no condition fires on every event of its type.** That is intended for a base rule, and a bug for a promotion. Add an `eventExpression` to narrow it.
- **Reward and counting are separate rules.** "Buy 5, get 1" is one rule that counts each purchase toward a counter target and a second rule that rewards when the target is achieved.
- **Audiences built from history cannot be checked on an arbitrary event.** The rule runs when the customer joins the audience, so turn on trigger on enter for it.
- **Tier ranks are ordered, codes are not.** Never infer order from the code or name. Give every tier a distinct rank.
- **Codes are permanent.** Lowercase letters, digits and hyphens, locked after creation. Pick codes that will still make sense after a rebrand; put the brand in the display name.
- **Deleting is permanent** and can affect balances, rules and customers who hold the record. Prefer pausing a rule, or publishing a new version.
- **Edit published things through a new version**, not in place: rules and flows have drafts and published versions.
- **Several programs sharing one currency or rule** is allowed; check which programs a change touches before publishing.
- **Expiry type matters.** Fixed date wipes everyone on one day, fixed period counts from program start, rolling period expires each earning on its own clock. Rolling feels fairest and is hardest to explain.
- **Do not model identity or state as points.** Status belongs in tiers, goals in targets, achievements in badges.

Checklist for reviewing a design: [review checklist](references/review-checklist.md).
