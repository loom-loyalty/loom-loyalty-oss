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
  code: tier-contradict
  name: Tier Contradiction
  typeCode: standard
currency:
  code: tc-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Tier Contradiction

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| bronze | Bronze | 0               |
| silver | Silver | 500             |

## Freeform: program.description

Our four-tier rewards system gives every customer a path forward. Bronze,
Silver, Gold, and Platinum members unlock different perks as they spend
more time in our shop. The four levels are designed to keep the program
feeling fresh as customers grow with us.
