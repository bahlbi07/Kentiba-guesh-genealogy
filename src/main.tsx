import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xl max-w-md w-full text-center space-y-4 font-ethiopic">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl font-bold">
              ጉ
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              ተወለድ እንዳቦይ ከንቲባ ጉዕሽ
            </h2>
            <p className="text-sm text-stone-600">
              ኣፕሊኬሽን ኣብ ምኽፋት ጸገም ኣጋጢሙ። በጃኹም ዳግማይ ጀምሩ (Reload)።
            </p>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              ዳግማይ ጀምር (Reload)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

