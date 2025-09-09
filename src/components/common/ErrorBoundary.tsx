import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: any;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console so we can see details in DevTools
    console.error('Dashboard ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 m-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-semibold">A rendering error occurred in this section.</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
