/**
 * @loom-loyalty/ui
 *
 * UI component library for Loom Loyalty applications.
 * Provides primitives, shell components, and data display components.
 *
 * Usage:
 * - Import from main entry: `import { Button, Sidebar } from "@loom-loyalty/ui"`
 * - Import from subpaths for tree-shaking:
 *   - `import { Button } from "@loom-loyalty/ui/primitives"`
 *   - `import { Sidebar } from "@loom-loyalty/ui/shell"`
 *   - `import { StatCard } from "@loom-loyalty/ui/data-display"`
 * - Import styles: `import "@loom-loyalty/ui/styles/globals.css"`
 */

// Utilities
export { cn } from "./lib/utils";

// Query client test/preview provider (for harnesses that mount components
// needing a live QueryClient outside a real app tree, e.g. Storybook decorators)
export { QueryTestProvider } from "./test/query-client-wrapper";

// Accessibility utilities
export * from "./a11y";

// Hooks
export * from "./hooks";

// Primitives
export * from "./primitives";

// Forms (composite form components)
export * from "./forms";

// Shell components
export * from "./shell";

// Data display components
export * from "./data-display";

// Entity components (schema-driven)
export * from "./entity";

// Expression builder components
export * from "./expressions";

// Wizard components
export * from "./wizards";

// Animation components
export * from "./animations";

// AI Chat components
export * from "./ai";

// Analytics components
export * from "./analytics";

// Brand assets
export * from "./assets";
