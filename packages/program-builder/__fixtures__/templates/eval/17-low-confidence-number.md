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
  code: low-conf-num
  name: Low Confidence Number
  typeCode: standard
currency:
  code: lcn-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Low Confidence Number

## Freeform: program.description

Members get something around five points per dollar most of the time, give
or take a couple, depending on what we're feeling that week. Sometimes we
do double points, sometimes half. We haven't really pinned the exact rules
down yet because we're still figuring it out. The general idea is just
"more shopping equals more points," somewhere in that ballpark.
