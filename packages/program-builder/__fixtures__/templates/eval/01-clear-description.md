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
  code: clear-desc
  name: Clear Desc
  typeCode: standard
currency:
  code: cd-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Clear Desc

## Freeform: program.description

Clear Desc is a straightforward points program for a neighborhood coffee shop.
Customers earn one point for every dollar spent, and the program is focused on
rewarding weekday regulars.
