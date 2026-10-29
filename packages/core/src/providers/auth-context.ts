/**
 * Auth Provider Context
 * Context for accessing the AuthProvider
 */

import * as React from "react";
import type { AuthProvider } from "../types/auth-provider";

/**
 * Auth provider context
 */
export const AuthProviderContext = React.createContext<AuthProvider | null>(null);

AuthProviderContext.displayName = "AuthProviderContext";
