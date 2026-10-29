---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: true
  badges: true
  promotions: true
  programType: transactional
  signupBonus: false
  birthdayBonus: true
program:
  code: coffee-loyalty
  name: Coffee Loyalty
  typeCode: retail
  typeName: Retail
currency:
  code: bean
  name: Bean
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
birthdayBonusConfig:
  bonusPoints: 100
autoAwardBaseTier: true
---

# Coffee Loyalty

## Tiers

| code    | name    | pointsThreshold                                  | bonus                                                                                        |
| ------- | ------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| green   | Green   | Members start here.                              | Earn one Bean per dollar at the standard rate.                                               |
| gold    | Gold    | Earn 500 Beans within a rolling 12-month window. | Earn 20% more Beans per dollar; Beans never expire while Gold; extended birthday window.     |
| reserve | Reserve | Earn 2,500 Beans within a rolling 12-month year. | Earn 70% more Beans per dollar; multiple bonus days per year; invitation-only member events. |

## Badges

| code        | name        |
| ----------- | ----------- |
| first-order | First Order |

## Promotions

| name                  | description                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free Modification Day | On the first Monday of every month, every member receives one free drink modification (extra shot, syrup, cold foam) up to a $1 value.                                      |
| Double Bean Day       | On flagged calendar dates, members earn double Beans on every purchase. Gold members receive at least four Double Bean Days per year; Reserve members receive at least six. |
| Birthday Reward       | On a member's birthday, they receive one free handcrafted drink. Green members must redeem within one day, Gold within seven, Reserve within thirty.                        |
| Bring-Your-Cup Bonus  | Members who bring a reusable cup earn one extra Bean per dollar spent on that transaction.                                                                                  |
| Card Reload Bonus     | When a member reloads their digital card with $30 or more, they receive 10 bonus Beans. Reloads of $50 or more receive 25 bonus Beans.                                      |
| Punch Card Reward     | Members earn a free handcrafted drink after every 5 qualifying purchases. The counter resets each year.                                                                     |

## Metadata

| category  | typeCode            | code   | name   | description |
| --------- | ------------------- | ------ | ------ | ----------- |
| DATA_TYPE | PROGRAM_TYPE        | retail | Retail |             |
| DATA_TYPE | CURRENCY_TYPE       | points | Points |             |
| DATA_TYPE | COUNTER_TARGET_TYPE | POINTS | Points |             |
