'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertCircle className="w-12 h-12 text-danger mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-elevated text-sm font-medium text-foreground hover:opacity-90 transition-opacity border border-white/5"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
