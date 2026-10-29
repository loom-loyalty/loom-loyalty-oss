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
  code: ambiguous
  name: Ambiguous
  typeCode: standard
currency:
  code: am-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Ambiguous

## Freeform: program.description

Something about rewarding customers maybe. The details are TBD and I'm not sure
what we want this to say yet.
