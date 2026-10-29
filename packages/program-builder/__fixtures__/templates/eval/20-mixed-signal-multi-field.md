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
  code: mixed-signal
  name: Mixed Signal
  typeCode: standard
currency:
  code: ms-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Mixed Signal

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| bronze | Bronze | 0               |
| silver | Silver | 500             |

## Freeform: program.description

A neighborhood pet supply shop's loyalty program. Customers earn points on
food, toys, and grooming services and can redeem for store credit or a
small selection of in-house gift cards.

## Freeform: tiers[1].description

Maybe something cool. We'll figure it out later.

## Freeform: marketingNotes

Launch via email to our existing customer list and our weekly newsletter.
Run a small social campaign during opening week, focused on Instagram and
local-business cross-promotion. Follow up with a referral SMS for any
customer who signs up but doesn't redeem points in the first 30 days.
