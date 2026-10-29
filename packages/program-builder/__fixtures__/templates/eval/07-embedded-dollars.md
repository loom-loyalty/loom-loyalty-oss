---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: embedded-dollars
  name: Embedded Dollars
  typeCode: standard
currency:
  code: ed-cashback
  name: Cashback
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 0.05
---

# Embedded Dollars

## Freeform: program.description

Earn $5 back on every $100 you spend at our store. We've kept the math simple
on purpose — every receipt over $20 banks something toward your next visit, and
the cashback rolls over month to month with no expiration. Customers who spend
more than $500 in a quarter get a small thank-you gift on top.
