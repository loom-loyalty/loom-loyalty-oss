# Program design review checklist

Use when reviewing a design, a pull request that changes a config file, or a plan output.

**Structure**

- [ ] Every tier has a distinct rank; rank 1 is the highest status.
- [ ] There is a rule that gives new customers their starting tier.
- [ ] Every tier above the base has a way in (a target plus a rule, or an explicit grant).
- [ ] Expiry and pending policy are chosen for each currency, even if the choice is "none".

**Rules**

- [ ] Each rule has the right category, so base earning runs before promotions.
- [ ] Every promotion has a condition; none fires on every event by accident.
- [ ] Tier-specific actions sit on an `and` node with the tier condition, not on a bare tier check.
- [ ] Tier bonuses add the extra portion only; they do not double-pay the base rate.
- [ ] Count-then-reward goals are two rules (count, then reward on achievement).
- [ ] Anything that waits or branches is a flow, not a chain of rules.
- [ ] Rules that award currency were backtested.

**Safety**

- [ ] Codes use lowercase letters, digits and hyphens, and contain no brand or campaign dates.
- [ ] Nothing relies on deleting a record; retirement is by pause or archive.
- [ ] Changes are backward compatible for live customers: no tier removed while customers hold it, no currency deleted while balances exist.
- [ ] The promotion path to production is planned, with the approval step named.

**Integration**

- [ ] Each business event is sent once, with a stable identifier on the sender's side.
- [ ] Webhook consumers deduplicate on `messageId`. See the loom-loyalty-api skill.
