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
  code: multi-field
  name: Multi Field
  typeCode: standard
currency:
  code: mf-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Multi Field

## Tiers

| code   | name   | pointsThreshold |
| ------ | ------ | --------------- |
| bronze | Bronze | 0               |
| silver | Silver | 500             |

## Freeform: program.description

Multi Field is an experimental tiered loyalty program for a coffee chain that
wants to reward their most loyal customers with escalating perks.

## Freeform: marketingNotes

Launch campaign: email blast to all existing customers on the first Monday of
the quarter, with a free drink for anyone who enrolls in the first week.
