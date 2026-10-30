# Offer fields

What `create_offer` takes, in the words to use with the marketer. Collect these in chat before any write call.

## Required

| Field      | Ask the marketer                            | Notes                                                                                  |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| type       | Is it your own coupon or a partner's offer? | COUPON or EXTERNAL                                                                     |
| code       | (You choose)                                | Unique, lower-kebab-case, for example holiday-15-off. Check `list_offers` for clashes. |
| name       | What should members see as the title?       | Up to 255 characters                                                                   |
| programIds | Which program?                              | From `list_programs`                                                                   |

## Value (coupon offers)

| Field                    | Ask                                                     | Notes                                                |
| ------------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| couponDiscountType       | Percent off, amount off, buy X get Y, or free shipping? | PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, FREE_SHIPPING |
| maxDiscountValue         | What is the most it can take off?                       | A number                                             |
| discountCurrencyTypeCode | Which currency is the amount in?                        | Only for amount-based discounts                      |

For a partner offer, set externalOfferId to the partner's own offer id.

## Who and how often

| Field               | Ask                                   | Notes                                                            |
| ------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| customerAudienceId  | Who can get it?                       | From `list_customer_audiences`; omit for everyone in the program |
| maxOfferUses        | How many times can one member use it? | Whole number, 1 or more                                          |
| maxOfferRedemptions | How many redemptions in total?        | Whole number, 1 or more                                          |

## When

There are two separate date controls. Explain the difference if it matters:

- **The enable window**: the start and end dates you pass to `request_enable_in_environment`. This is when the offer is available in that environment.
- **durationPeriod**: how long the offer stays valid once a member gets it, for example 30 days from issue. Example shape: a sliding period of 30 days.

Coupon codes can also have their own start and end dates through `create_offer_coupon_code`. An end date needs a start date and must not be before it.

## Presentation

| Field        | Ask                                                             |
| ------------ | --------------------------------------------------------------- |
| description  | A short line members will read (localized, for example English) |
| imageUrl     | An image to show, if they have one                              |
| categoryCode | A category, if the program uses them                            |

## Review summary

Show this before asking for a yes. Use only values the marketer gave or the tools returned.

**Offer:** 15% off for Gold members

- Type: coupon, 15% off, at most 20 off per use
- Who: Gold members (about 4,800 today)
- When: December 1 to December 24, Central time
- Limits: once per member, 2,000 redemptions in total
- Valid for 14 days after a member receives it
- Code: GOLD15
- Members see: "15% off your next order, our thanks for being Gold"

**When you say yes I will:**

1. Create the offer. In some programs this makes it live immediately.
2. Add the code GOLD15.
3. Request it in Production for December 1 to December 24. This may wait for an approver.

Shall I go ahead?
