import { ACTION_CATEGORIES } from "./utils.js";

const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  Currency: "bg-success",
  Coupons: "bg-accent",
  "Badges & Tiers": "bg-accent",
  Targets: "bg-info",
  Audiences: "bg-primary",
  Metadata: "bg-secondary",
  "External Offers": "bg-accent",
};

const ACTION_COLOR_CLASSES = Object.fromEntries(
  Object.entries(ACTION_CATEGORIES).flatMap(([category, actionTypes]) =>
    actionTypes.map((actionType) => [
      actionType,
      CATEGORY_COLOR_CLASSES[category] ?? "bg-muted-foreground",
    ])
  )
);

export function getActionCategoryColor(type: string): string {
  return ACTION_COLOR_CLASSES[type] ?? "bg-muted-foreground";
}
