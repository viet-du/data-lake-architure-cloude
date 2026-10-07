import { Component, type ErrorInfo, type ReactNode } from 'react';
import { cn } from '@/theme';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const DEFAULT_ERROR_TITLE = 'Something went wrong';
const DEFAULT_ERROR_DESC =
  'An error occurred while rendering this view. Please try again or contact support if the issue persists.';

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function DefaultErrorFallback({ error, reset }: DefaultErrorFallbackProps) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] w-full flex-col items-center justify-center gap-3',
        'rounded-xl border border-red-500/30 bg-red-500/5 p-8 backdrop-blur-md',
      )}
      role="alert"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-red-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-red-600 dark:text-red-400">
        {DEFAULT_ERROR_TITLE}
      </h3>
      <p className="max-w-md text-center text-sm text-neutral-600 dark:text-neutral-400">
        {DEFAULT_ERROR_DESC}
      </p>
      <code className="max-w-md truncate rounded bg-neutral-900/50 px-2 py-1 font-mono text-xs text-red-400">
        {error.message}
      </code>
      <button
        type="button"
        onClick={reset}
        className={cn(
          'mt-2 inline-flex h-9 items-center justify-center px-4',
          'rounded-lg border border-white/10 bg-white/10 text-sm font-medium text-neutral-900 dark:text-neutral-50',
          'transition-all duration-200 hover:bg-white/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
        )}
      >
        Try again
      </button>
    </div>
  );
}
