/**
 * Router Provider Context
 * Context for accessing the RouterProvider
 */

import * as React from "react";
import type { RouterProvider } from "../types/router-provider";

/**
 * Router provider context
 */
export const RouterProviderContext = React.createContext<RouterProvider | null>(null);

RouterProviderContext.displayName = "RouterProviderContext";
