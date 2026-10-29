---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: true
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
  name: Bean
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Coffee Loyalty

## Badges

| code        | name        |
| ----------- | ----------- |
| first-order | First Order |
