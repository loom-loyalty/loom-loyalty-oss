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
  code: freeform-demo
  name: Freeform Demo
  typeCode: standard
currency:
  code: demo-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Freeform Demo

## Badges

| code       | name       |
| ---------- | ---------- |
| early-bird | Early Bird |

## Freeform: description

This is a demo program used to test that freeform prose sections round-trip
without the parser touching them. The body can include **formatting**, lists,
and multi-paragraph prose.

## Freeform: marketingNotes

Another freeform section. Parsers should preserve each one independently and
emit them as separate pending extraction requests.
