/**
 * Hook to set the document title dynamically
 *
 * Format: "PageName | OrgName - AppName" (or "PageName - AppName" if no org)
 */
import { useEffect } from "react";

export function useDocumentTitle(
  pageName: string,
  options?: { orgName?: string | null; appName: string }
): void {
  const appName = options?.appName ?? pageName;
  const orgName = options?.orgName;

  useEffect(() => {
    document.title = orgName ? `${pageName} | ${orgName} - ${appName}` : `${pageName} - ${appName}`;
    return () => {
      document.title = appName;
    };
  }, [pageName, orgName, appName]);
}
