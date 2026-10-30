# Answering analytics questions

Patterns for common questions. In each case, find the analytics tool by its purpose, pass the period, and use only the numbers it returns.

## Choosing the period

| The marketer says      | Use                                                                            |
| ---------------------- | ------------------------------------------------------------------------------ |
| Nothing about time     | The last 30 days up to today; say so                                           |
| "This month"           | The first of the month to today                                                |
| "Last month"           | The whole previous calendar month                                              |
| "During the campaign"  | The campaign's own start and end dates; read them from the rule, flow or offer |
| "Since launch"         | From the start date to today                                                   |
| "Compared with before" | The same length of time just before the start date                             |

Ask for the time zone once if it matters and is not known. State it with the dates.

A period that includes today is partial. Say so, for example "October 1 to October 29 (today is not complete)".

## Question patterns

**"How did the November double points campaign do?"**
Find the rule or flow by name. Use a campaign or rule performance tool for the campaign dates. Report members reached, rewards issued, and, if a program summary tool is there, how purchases compared with the same length of time before.

**"How many Gold members do we have?"**
A tier breakdown tool answers this for a period. If only the read tools are available, `list_tiers` names the tiers and `get_customer_audience_count` counts a matching segment if one exists. Say which you used.

**"Is the holiday offer working?"**
Find the offer with `list_offers`. Use an offer performance tool for issued, redeemed and redemption rate over the offer's dates.

**"Are points redemptions going up?"**
Use a trend tool over a period long enough to show a trend (for example 12 weeks, by week). Describe the direction in one sentence, then give the first and last values and the change.

## Wording

- Round sensibly: "about 12,400 members", "31% redeemed". Keep the exact figure if the marketer asks.
- Give percentages with their base: "31% of the 4,800 coupons issued".
- Name differences plainly: "up 8% on September", not "positive delta".
- Do not explain causes the data does not show. You can suggest a likely reason only if you label it as a guess and name what would confirm it.

## When something is off

- **Zero or empty results**: check the subject and the period before reporting zero. Then say "I found no activity for X between A and B" rather than "it did nothing".
- **A tool error**: say which question you could not answer and suggest trying again later. Do not fill the gap with an estimate.
- **Numbers that disagree between tools**: report both with their source tool's purpose and period, and say they differ.
