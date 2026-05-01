'use client';

import { agentLogger } from '@/lib/utils/agent-logger';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DesignerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to our new agentLogger for later debugging
    agentLogger.log({
      source: 'system',
      level: 'error',
      message: `UI Crash in [${this.props.componentName || 'Unknown Component'}]`,
      details: { error: error.message, stack: errorInfo.componentStack },
    });

    console.error('Uncaught error in Designer:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // In a real app, we might want to try and recover the state or clear the offending component
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[100px] p-6 text-center bg-slate-900/50 rounded-lg border border-red-500/20 backdrop-blur-sm">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1">
              {this.props.componentName || 'Component'} Failed
            </h3>
            <p className="text-slate-400 text-[10px] max-w-[200px] mb-4">
              An unexpected error occurred in this section of the designer.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md text-[10px] font-medium transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default DesignerErrorBoundary;
