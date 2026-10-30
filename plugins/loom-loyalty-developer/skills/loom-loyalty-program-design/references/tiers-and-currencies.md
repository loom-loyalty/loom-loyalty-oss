# Tiers, currencies, expiry and pending rules

## Tiers

| Field              | Notes                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `code`             | Unique, locked after creation                                                                        |
| `rank`             | Whole number, at least 1. Lower is higher; 1 is the top tier                                         |
| `programCodes`     | A tier can belong to several programs                                                                |
| `subscription`     | True if the tier is unlocked through a recurring subscription                                        |
| Duration           | Optional. Period type Sliding, Calendar or Fixed, with a value and unit (days, weeks, months, years) |
| Downgrade tier     | The tier a member drops to when this one expires. Cannot be itself                                   |
| Downgrade duration | How long they stay at the downgraded tier                                                            |

A tier definition does not say how a customer earns it. Entry is a rule's action (issue the tier) or a target being achieved. Typical shapes:

- **Base tier on signup**: an event rule on customer creation that issues the lowest tier for life.
- **Earn your way up**: a counter target per tier (for example currency earned within a rolling window), and a rule that issues the tier when the target is achieved.
- **Sliding vs calendar**: a sliding window keeps tier status moving with recent activity; a calendar window resets on a date, which is easier to message and creates cliffs.

Avoid a downgrade chain that loops. Tier duration plus downgrade is how status lapses; without it a tier is permanent.

## Currencies

A currency has a name, code, type (such as loyalty points or cash-back), and one or more programs. Optionally attach a pending rule and an expiry rule.

- One currency can serve several programs.
- Attach pending and expiry rules before launch.

### Expiry rules

| Type           | Behaviour                                                          |
| -------------- | ------------------------------------------------------------------ |
| Fixed date     | All balances expire on one date                                    |
| Fixed period   | Balances expire after a period counted from the program start date |
| Rolling period | Each balance expires a set time after it was earned                |

### Pending rules

Hold newly earned currency out of reach until released.

| Type            | Behaviour                                              |
| --------------- | ------------------------------------------------------ |
| Fixed date      | Pending until a date                                   |
| Fixed period    | Pending for a period                                   |
| Rolling period  | Pending for a period counted from when it was acquired |
| Manual          | Needs explicit approval                                |
| Pending on item | Resolves from the status of the associated item        |

Use pending when earning can be reversed (returns, cancellations, a stay that has not completed). Without pending, a returned purchase leaves the customer with points they should not have.

## Targets

| Type       | Use                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Completion | Done or not done                                                                                           |
| Counter    | Count up to a value, like a punch card. Can be a capping target, cycle through repeats, or grow each cycle |
| Milestone  | An ordered series of other targets (at least 2 steps)                                                      |
| X of Y     | Hit some of a group                                                                                        |

The target type cannot change after creation. Capping, cycles, growth, registration and how rules use targets (promotion, occurrence and currency targets): [targets](targets.md).

## Offers

Types: Coupon (carries codes customers redeem) and External (managed by another system). The type cannot change after creation. Limits: duration after issue, max uses, max redemptions; empty means unlimited. Coupon offers choose a discount type (percentage, fixed amount, buy X get Y, free shipping) and how codes arrive: auto-generated batch, or added manually. Never leave a coupon offer with neither.

## Audiences

- **Customer list**: fixed membership.
- **Customer segment**: membership from a condition tree; versioned (draft, published).
- Trigger on enter and trigger on exit fire events when a customer joins or leaves. Turn on trigger on enter when a rule should react to joining a history-based audience.
- Reuse an existing audience in rules and offers rather than duplicating its conditions.
