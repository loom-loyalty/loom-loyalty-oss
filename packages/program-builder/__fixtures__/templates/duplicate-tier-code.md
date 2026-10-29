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
  code: dup-tiers
  name: Dup Tiers
  typeCode: standard
currency:
  code: dup-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
autoAwardBaseTier: true
---

# Dup Tiers

## Tiers

| code | name   | pointsThreshold |
| ---- | ------ | --------------- |
| gold | Gold   | 0               |
| gold | Golden | 500             |
