# Worked example

A small tiered program. Shapes follow what `treadle pull` writes. Field names inside records can vary by release, so after the first `treadle pull`, prefer the shapes the server returns.

```yaml
schema: loom-loyalty-config.v1
code: cafe-rewards
name: Cafe rewards

metadata:
  - type: CURRENCY_TYPE
    code: points
    name: Points

eventTypes:
  - code: purchase-completed
    name: Purchase completed

programs:
  - code: cafe-rewards
    typeCode: tiered
    name: Cafe Rewards
    createAccountOnCustomerCreation: true

programCurrencies:
  - code: beans
    programCodes: [cafe-rewards]
    name: Beans
    currencyTypeCode: points

tiers:
  - code: green
    programCodes: [cafe-rewards]
    name: Green
    rank: 3
    subscription: false
  - code: gold
    programCodes: [cafe-rewards]
    name: Gold
    rank: 2
    subscription: false
  - code: reserve
    programCodes: [cafe-rewards]
    name: Reserve
    rank: 1
    subscription: false

eventRules:
  # Everyone starts on the base tier when the customer is created.
  - code: cafe-base-tier
    category: BASE
    eventTypeCode: customer.created
    name: Base tier on signup
    programCodes: [cafe-rewards]
    eventActionsExpression:
      "true":
        actions:
          - issueCustomerTier:
              tierCode: green
              issueLifetimeTier: true
              issueTrialTier: false
              synchronous: false
              valid: true
    processItemsIndividually: false

  # A fixed bonus on every purchase-completed event. Illustrative: it has no condition,
  # so it fires each time. Add an eventExpression or a cap to narrow it.
  - code: cafe-purchase-bonus
    category: PROMOTION
    eventTypeCode: purchase-completed
    name: Purchase bonus
    programCodes: [cafe-rewards]
    eventActionsExpression:
      "true":
        actions:
          - issueProgramCurrency:
              programCode: cafe-rewards
              programCurrencyCode: beans
              defaultResult: 50
              isFixedAmount: true
              registerTargets: false
              synchronous: false
              valid: true
    processItemsIndividually: false
```

Notes:

- `rank` 1 is the top tier. Ranks are whole numbers, 1 or higher.
- `customer.created` is a built-in event type. `purchase-completed` is declared in `eventTypes` here, so it is a custom one.
- To restrict a rule to some events, add an `eventExpression`. To multiply earning by tier, see the loom-loyalty-program-design skill: a tier condition needs actions on an `and` node.
- The first `plan` against an empty organization shows `CREATE` for every record. After `apply`, a second `plan` exits 0.
