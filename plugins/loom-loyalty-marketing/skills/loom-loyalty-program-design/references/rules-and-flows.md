# Event rules and flows

## Event rules

A rule watches one event type and runs its actions whenever an event matches.

Parts of a rule, in the order the editor shows them:

| Part                 | Purpose                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name, code, category | Category sets the order rules run in: a `BASE` rule runs before a `PROMOTION` rule. Categories include `BASE`, `TIER`, `PROMOTION`, `TIER_AFTER_PROMOTION`, `ADJUSTMENT`, `REDEMPTION`, `COMMUNICATION`, `PARTNER`, `ORGANIZATION_DEFINED` |
| Programs             | One or more                                                                                                                                                                                                                                |
| Trigger              | The event type the rule listens for, optionally narrowed by a sub-type identifier                                                                                                                                                          |
| When                 | An optional condition tree. No condition means every event of that type                                                                                                                                                                    |
| Then do              | The actions: issue or withdraw currency, issue a badge, tier, coupon or offer, count toward a target, add to an audience, send a notification                                                                                              |
| Caps and limits      | Occurrence targets, currency targets, targets to exclude, process items individually, roll up results                                                                                                                                      |

Process items individually when the event carries line items (each line of a purchase) and each should be handled on its own.

Conditions are a boolean tree. Composite nodes are `and`, `or`, `not`, each with `children`. Leaves compare event fields by JsonPath (`$.eventData.<field>`): `equals`, `notEquals`, `greaterThan`, `lessThan`, `between`, `in`, `notIn`, `startsWith`, `matches`, `exists`, `empty`, and loyalty-specific ones: `currentTier`, `hasBadge`, `targetCompleted`, `hasProgramCurrency`. Actions hang off a node's `actions` list. Event-window operators such as counts and sums over days apply to audiences, not to a single event.

Lifecycle: draft, Publish, then New Version to change a live rule without touching it. Pause stops a rule processing rewards immediately in every environment it is enabled in; Resume restarts it. Backtest replays past events through the saved draft and the published version and shows the cost change per currency; run it before publishing any rule that awards currency.

## Flows

A flow has a trigger event (what enrolls a customer), steps connected into a graph, and a re-enrollment policy. A step can combine:

| Part        | Purpose                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| Wait        | Pause for a duration, or until an event happens. Optional resume condition and maximum wait |
| Only run if | A condition. Routes to a Yes step or a No step                                              |
| Caps        | Occurrence and currency targets that limit the step                                         |
| Then do     | Actions the step takes                                                                      |
| Then go to  | The next step when there is no condition                                                    |

A wait with a maximum wait can send customers down a timed-out path. A flow targets a customer, a group or an audience.

Versions: only one is live. A published version is read-only; edit as a new draft, then publish. Flows can be paused, resumed and archived. Blockers in the checks panel must be cleared before publishing.

Examples that are flows, not rules: a welcome series (issue an offer, wait 7 days, give bonus points if no purchase yet); a win-back (offer to a lapsed audience, wait up to 14 days for a purchase, branch on whether one arrives).

Examples that are rules: 1 point per dollar on every purchase; double points on weekend in-store purchases.

## Environments

Creating a rule or flow in one environment does not turn it on elsewhere. Enabling in another environment goes through that environment's approval workflow. Plan promotion as part of the design, not an afterthought.
