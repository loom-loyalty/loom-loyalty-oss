/**
 * Data Provider Context
 * Context for accessing the DataProvider
 */

import * as React from "react";
import type { DataProvider } from "../types/data-provider";

/**
 * Data provider context
 */
export const DataProviderContext = React.createContext<DataProvider | null>(null);

DataProviderContext.displayName = "DataProviderContext";
