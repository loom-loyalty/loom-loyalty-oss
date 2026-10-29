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
  code: unsorted-demo
  name: Unsorted Demo
  typeCode: standard
currency:
  code: unsorted-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
autoAwardBaseTier: true
---

# Unsorted Demo

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| gold   | Gold   | 2500            |
| bronze | Bronze | 0               |
| silver | Silver | 500             |
