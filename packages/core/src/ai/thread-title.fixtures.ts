/**
 * The one fixture table for `threadTitleFrom`: the AI server titles a new
 * thread from its first message with the same function the chat panel uses
 * to show the title the instant Enter is pressed, so both must agree on every
 * row here. Add a row for every shape a message can take.
 */
export const THREAD_TITLE_FIXTURES: ReadonlyArray<{
  name: string;
  message: string;
  title: string;
}> = [
  { name: "plain", message: "What tiers do we have?", title: "What tiers do we have?" },
  {
    name: "whitespace padded",
    message: "   Look up customer Nate Steffan \n",
    title: "Look up customer Nate Steffan",
  },
  {
    name: "multi-line collapses to one line",
    message: "Draft a rule:\n\n50 bonus points\ton a birthday",
    title: "Draft a rule: 50 bonus points on a birthday",
  },
  {
    name: "exactly 60 code points stays whole",
    message: "a".repeat(60),
    title: "a".repeat(60),
  },
  {
    name: "longer than 60 cuts on a word boundary with an ellipsis",
    message:
      "Pull up the customer with the most points and show their tier, balance and badges please",
    title: "Pull up the customer with the most points and show their…",
  },
  {
    name: "one very long word hard-cuts to 60 code points",
    message: "x".repeat(80),
    title: `${"x".repeat(59)}…`,
  },
  {
    name: "a short first word still hard-cuts rather than keeping only it",
    message: `a ${"y".repeat(80)}`,
    title: `a ${"y".repeat(57)}…`,
  },
  {
    name: "emoji at the cut is kept whole",
    message: `${"b".repeat(58)}🎂🎂🎂 and more`,
    title: `${"b".repeat(58)}🎂…`,
  },
  {
    name: "attachment-only message titles the synthesized sentence",
    message: "I uploaded a program template (coffee-club.pdf).",
    title: "I uploaded a program template (coffee-club.pdf).",
  },
  { name: "blank is empty", message: " \n\t ", title: "" },
  { name: "empty is empty", message: "", title: "" },
];
