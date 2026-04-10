'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `Uncaught error in ${this.props.componentName || 'Component'}:`,
      error,
      errorInfo
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 gap-4 min-h-[100px] w-full shadow-inner">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {this.props.componentName || 'Component'} Failed
            </h3>
          </div>
          <p className="text-[11px] text-center opacity-80 max-w-xs">
            An error occurred while rendering this section. You can try resetting this part of the
            UI.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold uppercase rounded hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
