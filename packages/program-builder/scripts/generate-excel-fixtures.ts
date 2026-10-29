import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProgramSpec } from "../src/spec.js";
import { excelFormat } from "../src/template-doc/excel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../__fixtures__/templates/excel");

const happyPath: ProgramSpec = {
  selectedFeatures: {
    programCurrency: true,
    expiry: false,
    pending: false,
    tiers: true,
    badges: true,
    promotions: true,
    programType: "transactional",
    signupBonus: false,
    birthdayBonus: true,
  },
  program: {
    code: "coffee-loyalty",
    name: "Coffee Loyalty",
    typeCode: "retail",
    typeName: "Retail",
  },
  currency: { code: "bean", name: "Bean", currencyTypeCode: "points" },
  tiers: [
    {
      code: "green",
      name: "Green",
      pointsThreshold: 0,
      earnMultiplier: 1.0,
    },
    {
      code: "gold",
      name: "Gold",
      pointsThreshold: 500,
      earnMultiplier: 1.2,
    },
    {
      code: "reserve",
      name: "Reserve",
      pointsThreshold: 2500,
      earnMultiplier: 1.7,
    },
  ],
  badges: [{ code: "first-order", name: "First Order" }],
  promotions: [
    {
      code: "free-modification-day",
      name: "Free Modification Day",
      description:
        "On the first Monday of every month, every member receives one free drink modification (extra shot, syrup, cold foam) up to a $1 value.",
      eventType: { code: "drink_modification", name: "Drink Modification" },
      targets: [],
      eventRules: [
        {
          award: { type: "FREE_ITEM", value: "modification" },
          conditions: { equalsPath: "$.eventData.dayOfWeek", equalsValue: "MONDAY" },
        },
      ],
    },
    {
      code: "double-bean-day",
      name: "Double Bean Day",
      description:
        "On flagged calendar dates, members earn double Beans on every purchase. Gold members receive at least four Double Bean Days per year; Reserve members receive at least six.",
      eventType: { code: "purchase", name: "Purchase" },
      targets: [],
      eventRules: [
        {
          award: { type: "MULTIPLIER", value: 1 },
          conditions: { equalsPath: "$.eventData.doubleBeanDay", equalsValue: true },
        },
      ],
    },
    {
      code: "birthday-reward",
      name: "Birthday Reward",
      description:
        "On a member's birthday, they receive one free handcrafted drink. Green members must redeem within one day, Gold within seven, Reserve within thirty.",
      eventType: { code: "birthday", name: "Birthday" },
      targets: [],
      eventRules: [{ award: { type: "FREE_ITEM", value: "handcrafted_drink" } }],
    },
    {
      code: "bring-your-cup-bonus",
      name: "Bring-Your-Cup Bonus",
      description:
        "Members who bring a reusable cup earn one extra Bean per dollar spent on that transaction.",
      eventType: { code: "purchase", name: "Purchase" },
      targets: [],
      eventRules: [
        {
          award: { type: "MULTIPLIER", value: 1 },
          conditions: { equalsPath: "$.eventData.reusableCup", equalsValue: true },
        },
      ],
    },
    {
      code: "card-reload-bonus",
      name: "Card Reload Bonus",
      description:
        "When a member reloads their digital card with $30 or more, they receive 10 bonus Beans. Reloads of $50 or more receive 25 bonus Beans.",
      eventType: { code: "card_reload", name: "Card Reload" },
      targets: [],
      eventRules: [
        {
          award: { type: "FLAT_POINTS", value: 10 },
          conditions: { equalsPath: "$.eventData.reloadTier", equalsValue: "RELOAD_30" },
        },
        {
          award: { type: "FLAT_POINTS", value: 25 },
          conditions: { equalsPath: "$.eventData.reloadTier", equalsValue: "RELOAD_50" },
        },
      ],
    },
    {
      code: "punch-card-reward",
      name: "Punch Card Reward",
      description:
        "Members earn a free handcrafted drink after every 5 qualifying purchases. The counter resets each year.",
      eventType: { code: "purchase", name: "Purchase" },
      targets: [
        {
          kind: "COUNTER",
          config: { counterTargetTypeCode: "QUALIFYING_PURCHASES", targetValue: 5 },
        },
      ],
      eventRules: [{ award: { type: "FREE_ITEM", value: "handcrafted_drink" } }],
    },
  ],
  metadata: [
    { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "retail", name: "Retail" },
    { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "points", name: "Points" },
  ],
  awardRule: {
    templateId: "points-per-dollar",
    templateConfig: { pointsPerDollar: 1 },
    rulePayload: {},
  },
  autoAwardBaseTier: true,
  birthdayBonusConfig: { bonusPoints: 100 },
};

async function main(): Promise<void> {
  const result = await excelFormat.render!(happyPath);
  const target = resolve(OUT, "happy-path-coffee-shop.xlsx");
  writeFileSync(target, result.buffer);
  console.log(`Wrote ${target} (${result.buffer.byteLength} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
