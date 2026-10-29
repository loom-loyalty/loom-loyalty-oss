import type { ComponentRenderProps, DefinedComponent } from "@openuidev/react-lang";
import { defineComponent as _defineComponent } from "@openuidev/react-lang";
import type { ComponentType } from "react";
import { z } from "zod";

import {
  Award,
  BarChart3,
  Building2,
  Crown,
  DollarSign,
  Dumbbell,
  Gift,
  Heart,
  Layers,
  Plane,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  users: Users,
  dollar: DollarSign,
  chart: BarChart3,
  star: Star,
  gift: Gift,
  target: Target,
  tag: Tag,
  award: Award,
  trending: TrendingUp,
  cart: ShoppingCart,
  settings: Settings,
  layers: Layers,
  zap: Zap,
  crown: Crown,
  heart: Heart,
  // Industry icons
  shopping: ShoppingBag,
  store: Store,
  building: Building2,
  utensils: UtensilsCrossed,
  sparkles: Sparkles,
  plane: Plane,
  dumbbell: Dumbbell,
};

export function resolveIcon(name?: string): ComponentType<{ className?: string }> {
  return (name && iconMap[name]) || Star;
}

/**
 * Wrapper for `defineComponent` that preserves full type inference
 * for the component's props within the component renderer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineOpenUIComponent<T extends z.ZodObject<any>>(config: {
  name: string;
  props: T;
  description: string;
  component: React.FC<ComponentRenderProps<z.infer<T>>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): DefinedComponent<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _defineComponent(config as any);
}

/** Reusable Zod fragments for OpenUI component prop schemas */
export const variantSchema = z.enum([
  "default",
  "primary",
  "secondary",
  "success",
  "accent",
  "destructive",
]);

export const sizeSchema = z.enum(["sm", "md", "lg"]);

export const actionSchema = z.object({
  label: z.string(),
  action: z.string(),
  description: z.string().optional(),
});
