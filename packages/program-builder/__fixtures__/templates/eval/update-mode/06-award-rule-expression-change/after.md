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
    pointsPerDollar: 2
  rulePayload:
    code: coffee-loyalty-earn
    name: Earn Beans
    eventTypeCode: PURCHASE
    category: ORGANIZATION_DEFINED
    eventActionsExpression: "ISSUE_POINTS:2"
---

# Coffee Loyalty
