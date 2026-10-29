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
  code: long-prose
  name: Long Prose
  typeCode: standard
currency:
  code: lp-points
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

# Long Prose

## Freeform: program.description

Sunbeam Coffee is a small two-location café in Portland, Oregon, and our
loyalty program is named after our most-ordered drink: the Sunbeam Latte.
The program rewards regulars who keep coming back, especially on weekday
mornings when our staff is at its most caffeinated and our pastries are
freshest. Every dollar spent at either location earns one Sunbeam Point,
and points can be redeemed for drinks, pastries, retail bags of beans, or
gift cards in any denomination.

We built this program because our regulars asked for it. Three years in,
the same faces kept showing up on the same mornings, ordering nearly the
same drinks, and we wanted a thank-you that survived multiple visits without
feeling transactional. Sunbeam Coffee is the kind of place where the
barista knows your name, and we wanted the loyalty program to feel like
that — small, recognizable, easy to explain in one sentence.

The mechanics are intentionally simple. There are no tiers, no expiration
dates, no surprise rules. You earn one point per dollar, and when you have
enough points, you can spend them. We considered tiers and birthday bonuses
but decided to keep the first version of the program small. If we add
features later, we'll do it because regulars asked for them, not because
the loyalty platform offers more checkboxes.

What we love about coffee shops is that they're community spaces. Our
loyalty program shouldn't get in the way of that. The barista should not
have to ask three questions at the register, and the customer should not
have to remember a punch card. So Sunbeam Points live on a phone number —
you give us your number, we look up your account, and the points just
work. No app to install, no email signup unless you want it, no password
to forget.

Behind the scenes, we built this on top of a simple receipt-based earning
system. Every transaction at the register flows into the loyalty database
within a few seconds, and the points are available immediately. Customers
can redeem in real time, including for the same drink they're ordering,
which we think is the right behavior for a small-shop program. If your
account has 250 Sunbeam Points and you order a $4 latte, you can spend
those points in the same transaction. We did not want a 24-hour delay or
a separate redemption flow.

We're particularly proud of the way the program handles edge cases. If a
customer's points balance is short by a few cents, the register prompts
the barista to ask whether the customer wants to pay the difference or
top up. If a card is shared between family members, we treat that as a
single account by default, but we surface a warning if the spending pattern
suggests two distinct people are using the same number. These are small
details, but they're the kinds of details that decide whether a regular
keeps using the program after the first month.

Looking ahead, we may add seasonal promotions: extra points on the first
day of fall, a small bonus for birthday weeks, double points during the
two weeks before our Black Friday sale. None of those are essential to the
program working, and we're explicit with our team that the core program is
"one dollar, one point, redeem whenever you want."

We also want to be careful about not turning the loyalty program into a
data-collection exercise. We don't ask for a customer's email address at
signup. We don't sell their phone number. We don't send marketing texts
unless they explicitly opt in, and even then we send fewer than one a
month. The program exists to thank regulars, not to harvest them. If a
customer wants to delete their account, the barista can do it from the
register in under thirty seconds. If a customer wants their data exported,
we email them a CSV within a day. None of this is novel — it's just the
basic decency we want from any loyalty program we'd be a customer of.

The success metric we care about most is whether regulars stay regulars.
Punch-card programs work because they reward frequency directly; our
points-per-dollar program works because it rewards both frequency and
basket size, and our regulars can see in real time how their balance is
growing. We measure success by retention at the 90-day and 365-day marks,
not by transaction volume or gross-merchandise-value. If a regular comes
in three times a week for a year, we're winning. If a regular's frequency
drops, we want to know — not so we can spam them with discount codes, but
so our staff can ask whether something changed.

That last detail matters more than the program mechanics. The program is
just an excuse to know our regulars by name, and the data is just a tool
that helps us notice when somebody we used to see every morning has been
absent for a month. Sometimes that means somebody moved or changed jobs
and we lose them; sometimes it means a regular was sick or going through
something hard, and a "we missed you" is the right message. The loyalty
software runs the math; the staff runs the relationship.
