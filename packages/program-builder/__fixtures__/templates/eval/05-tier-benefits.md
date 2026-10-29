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
  code: tier-bene
  name: Tier Benefits
  typeCode: standard
currency:
  code: tb-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Tier Benefits

## Tiers

| code     | name     | pointsThreshold |
| -------- | -------- | --------------- |
| standard | Standard | 0               |
| vip      | VIP      | 1000            |

## Freeform: tiers[1].description

VIP members get priority seating during weekend brunch, free refills on drip
coffee, and one complimentary pastry per visit.
