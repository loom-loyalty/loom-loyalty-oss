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
  code: md-formatting
  name: Markdown Formatting
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

# Markdown Formatting

## Freeform: program.description

Our **flagship rewards program** for an indie record store in Brooklyn.
Members earn points across these channels:

- In-store purchases at our Williamsburg counter
- Online orders shipped from our warehouse
- _Special_ event ticket sales for in-store performances

Highlights:

1. **Members-only listening parties** every other Friday
2. Early access to limited-edition pressings
3. A `members-only` discount on used vinyl

The program is `points-per-dollar` at the base rate, with intentionally
simple math so customers can do the conversion in their heads at the
register.
