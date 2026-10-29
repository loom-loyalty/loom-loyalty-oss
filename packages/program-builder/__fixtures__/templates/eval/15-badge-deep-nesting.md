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
  code: badge-deep
  name: Badge Deep Nesting
  typeCode: standard
currency:
  code: bd-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Badge Deep Nesting

## Badges

| code        | name        |
| ----------- | ----------- |
| first-visit | First Visit |
| early-bird  | Early Bird  |

## Freeform: badges[1].description

The Early Bird badge unlocks for members who order before 8 AM at least
ten weekdays in a row. Earning it once gets you a small permanent perk:
a complimentary single-shot of espresso added to any drink, on any
morning, no questions asked. We added the badge after our 6 AM regulars
asked for something that recognized their hours, and we've kept it
intentionally specific so it stays meaningful.
