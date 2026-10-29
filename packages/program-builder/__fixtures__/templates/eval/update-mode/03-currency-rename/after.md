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
  code: coffee-loyalty
  name: Coffee Loyalty
  typeCode: retail
  typeName: Retail
currency:
  code: bean
  name: Coffee Bean
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Coffee Loyalty

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| bronze | Bronze | 0               |
