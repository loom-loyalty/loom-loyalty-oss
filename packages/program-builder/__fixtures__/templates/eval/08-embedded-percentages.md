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
  code: embedded-pct
  name: Embedded Percentages
  typeCode: standard
currency:
  code: ep-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Embedded Percentages

## Freeform: program.description

We run weekly bonuses on top of the base earn rate. Customers get a 15% bonus
on weekend visits and a 20% bonus during major holidays. Birthday weeks
include an additional 10% on every transaction. The percentages stack up
quickly for regulars who pay attention to the calendar.
