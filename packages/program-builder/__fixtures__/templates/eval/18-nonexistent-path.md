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
  code: nonexistent-path
  name: Nonexistent Path
  typeCode: standard
currency:
  code: np-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Nonexistent Path

## Freeform: program.tier1BonusPercent

This field doesn't exist on ProgramSpec. The prose talks about a 25% bonus
for tier-one members but the schema has no such field. The extractor
should recognize the path is unfamiliar and refuse to invent a structured
value that has nowhere to land.
