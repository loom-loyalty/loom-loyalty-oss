/**
 * Component Error Boundary
 *
 * Isolates custom component errors from crashing the application.
 * Displays a fallback UI and logs errors for debugging.
 */
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./button";

interface ComponentErrorBoundaryProps {
  /** Component name for error reporting */
  componentName: string;
  /** Fallback UI when component crashes */
  fallback?: ReactNode;
  /** Children to render */
  children: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, componentName: string) => void;
  /** Whether to show retry button */
  showRetry?: boolean;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches rendering errors from custom components.
 *
 * Features:
 * - Catches rendering errors from child components
 * - Displays fallback UI (not the whole page crashes)
 * - Logs errors for debugging
 * - Option to reset and retry
 */
export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, onError } = this.props;

    // Log error for debugging
    console.error(
      `[ComponentErrorBoundary] Error in custom component "${componentName}":`,
      error,
      errorInfo
    );

    // Call error callback if provided
    onError?.(error, componentName);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, componentName, fallback, showRetry = true } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      // Return custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Sanitize error message for production - avoid exposing internal paths/details
      const getSanitizedErrorMessage = (err: Error): string => {
        const isDev = process.env.NODE_ENV === "development";
        if (isDev) {
          return err.message;
        }
        // In production, only show generic message if error contains sensitive info
        const sensitivePatterns = [
          /\/Users\//i,
          /\/home\//i,
          /node_modules/i,
          /webpack/i,
          /at\s+\w+\s+\(/i, // Stack trace patterns
          /\.tsx?:\d+/i, // File:line patterns
        ];
        const hasSensitiveInfo = sensitivePatterns.some((pattern) => pattern.test(err.message));
        return hasSensitiveInfo ? "An unexpected error occurred" : err.message;
      };

      // Default fallback UI
      return (
        <div
          className="border-destructive/30 bg-destructive/5 rounded-lg border p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="text-destructive mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-destructive text-sm font-medium">Component Error</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The component &ldquo;{componentName}&rdquo; failed to render.
              </p>
              {error && (
                <p className="text-muted-foreground mt-2 truncate font-mono text-xs">
                  {getSanitizedErrorMessage(error)}
                </p>
              )}
              {showRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={this.handleRetry}
                  aria-label="Retry loading component"
                >
                  <RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Functional wrapper for ComponentErrorBoundary with convenient defaults
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, componentName: string) => void;
  }
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ComponentErrorBoundary
      componentName={componentName}
      fallback={options?.fallback}
      onError={options?.onError}
    >
      <WrappedComponent {...props} />
    </ComponentErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${componentName})`;

  return WithErrorBoundary;
}
