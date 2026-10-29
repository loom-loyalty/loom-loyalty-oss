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
  code: multi-para
  name: Multi Paragraph
  typeCode: standard
currency:
  code: mp-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Multi Paragraph

## Freeform: program.description

### Overview

This is a points program for a small chain of bookstores. Customers earn
points on every book they buy, redeem for store credit or events.

### Mechanics

Points never expire. Members can use them for in-store purchases, online
orders, or to RSVP to author events. The program is intentionally simple
because we sell books, not loyalty programs.

### Why we built it

Our regulars asked for it. We wanted a thank-you that survived multiple
visits without feeling transactional.
