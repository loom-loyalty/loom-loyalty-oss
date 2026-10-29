---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: true
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: tier-deep
  name: Tier Deep Nesting
  typeCode: standard
currency:
  code: td-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Tier Deep Nesting

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| bronze | Bronze | 0               |
| silver | Silver | 250             |
| gold   | Gold   | 1000            |

## Freeform: tiers[2].description

Gold members get the kind of perks regulars actually ask for: priority
ordering, an annual birthday gift, free name-on-the-cup engraving once
per quarter, and first dibs on any new menu items the morning they go
live. We try to keep gold feeling like a thank-you, not a transaction.
