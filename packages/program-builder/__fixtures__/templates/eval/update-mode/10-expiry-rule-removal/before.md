---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: true
  pending: false
  tiers: false
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
  name: Bean
  currencyTypeCode: points
expiryRule:
  code: bean-expiry
  name: Bean Expiry
  type: ROLLING_PERIOD
  expiryPeriod: MONTHS
  expiryPeriodValue: 12
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Coffee Loyalty
