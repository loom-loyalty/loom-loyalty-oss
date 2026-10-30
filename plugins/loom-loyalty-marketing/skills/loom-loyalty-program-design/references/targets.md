# Targets

A target is a goal or a limit tracked per customer. Rules and flow steps move targets forward, and can stop when one is reached. The target definition is shared; each customer gets their own instance with progress, achievement and, for counters, cycles.

## Types

The type is fixed at creation. Pick it from the question the target answers.

| Type       | Answers                      | What you set                                                                       | Achieved when                      |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Completion | Has it happened?             | A completion target type                                                           | The first time a rule completes it |
| Counter    | How many, or how much?       | A counter target type and a target value, plus optional capping, cycles and growth | Progress reaches the target value  |
| Milestone  | Did they do these, in order? | At least 2 steps, each another target, in order                                    | Every step is achieved, in order   |
| X of Y     | Did they do enough of these? | The available targets (Y) and how many to complete (X)                             | X of the Y targets are achieved    |

Milestone and X of Y are built from other targets, so create the step targets first.

## Settings every target has

- **Programs**: which programs it belongs to.
- **Scope**: Global, Program, Rule or Event. Global targets apply across programs; the others narrow the target to a program, a rule or an event.
- **Duration period**: an optional window. Outside an active window the target is not in force; with no window it always is.
- **Audience**: optionally limit who the target applies to.
- **Registration**:
  - `requiresRegistration`: the customer must be registered (opted in) before anything counts.
  - `retroAfterRegistration`: once registered, earlier qualifying activity counts too.
  - `reregisterOnAchievement`: after achieving it, the customer starts again on a fresh instance. Use this for repeatable goals such as a punch card that resets.

## Counter options

- **Target value**: the number to reach. What one step adds depends on how the target is referenced (see below): one per occurrence, or the currency amount issued.
- **Capping target**: the counter is a limit, not a goal. When it is reached, it stops the rule or trims the currency (see below). A non-capping counter only tracks progress.
- **Cycles**: repeat the counter over periods, such as monthly. `numberOfCycles` is how many periods. `numberOfCyclesToAchieve` is how many must be hit, which cannot exceed the number of cycles. `cyclesMustBeConsecutive` requires them in a row. `carryOverToNextCycle` carries any excess into the next period. `cycleDurationPeriod` sets the length of each period.
- **Growth**: change the goal each cycle with an operator (add, subtract, multiply, divide), an operand, and an algorithm that sets the base the operator applies to. The only algorithm today is `MIN_LAST_CYCLE`.

## How a rule uses a target

An event rule has four target slots. A flow step has the same caps, apart from the promotion target.

| Slot                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promotion target            | The one target the rule is offered as. Rules with a promotion target are what members see as promotions to work toward in the portal, and what the wallet pass counts. Without one, a rule does not show as a promotion (reward rules still appear on the Rewards screen).                                                                                                                                          |
| Occurrence targets          | Each time the rule fires, every listed completion target completes and every listed counter adds one. Milestone and X of Y targets move only through the targets they are built from, so list the step targets here, not the milestone itself. A capping counter, or any other target type, that is already achieved in its active window or cycle blocks the rule from firing. A non-capping counter never blocks. |
| Currency targets            | Tied to a program and currency. When the rule issues that currency, the amount counts toward the target. A capping currency target trims the award to what is left before the cap, and to zero once the cap is reached. A non-capping one only tracks the total.                                                                                                                                                    |
| Currency targets to exclude | Stops a capping target from trimming this rule's award. The award still counts toward the target only if the target is also listed in currency targets; then it counts without being cut, for a bonus that uses up the monthly cap but is always paid in full. Leave it out of currency targets and the award neither counts nor is trimmed. Each entry names the target, its program and its currency.             |

`registerTarget` on an occurrence or currency target (on by default) registers the customer automatically the first time the rule counts toward it. Turn it off when customers must opt in some other way first.

## Common shapes

- **Buy 5, get 1.** A non-capping counter with value 5 and `reregisterOnAchievement`. Rule A counts each purchase as an occurrence target. Rule B rewards when `targetCompleted` is true for that target. Keep counting and rewarding as two separate rules.
- **At most 3 bonuses a month.** A capping counter with value 3 on monthly cycles, set as an occurrence target on the bonus rule. The fourth event that month does not fire the rule.
- **At most 1,000 bonus points a month.** A capping counter with value 1,000 on monthly cycles, set as a currency target on the rule for that currency. An award that would cross the cap is trimmed.
- **Spend to reach a tier.** A non-capping currency target over the qualifying window, plus a rule that issues the tier once it is achieved. See [tiers and currencies](tiers-and-currencies.md).
- **A challenge with steps.** Completion targets for each step, then a milestone (in order) or an X of Y (any N) over them. List the step targets as occurrence targets on the rules that complete them, and make the milestone or X of Y the promotion target so members see their progress.

## Checks before publishing

- Is a counter meant to limit (capping) or to track (non-capping)? Getting this wrong either blocks rules that should run or never caps anything.
- Does every capping target sit on a rule that issues the capped currency, or fires the capped occurrence?
- Do cycles and the duration period line up with the business period (calendar month, rolling 30 days)?
- Will customers be registered? Either `registerTarget` stays on, or something else registers them. Otherwise nothing counts when `requiresRegistration` is set.
- Backtest the rule to see how the caps would have applied to past events.
