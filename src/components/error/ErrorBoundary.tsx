'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // logErrorToService(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="max-w-lg w-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <CardTitle>Oops! Something went wrong</CardTitle>
                    <CardDescription>
                      We encountered an unexpected error. Don't worry, your data is safe.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                    <p className="text-sm font-mono text-red-600 mb-2">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="text-xs text-gray-600">
                        <summary className="cursor-pointer hover:text-gray-800">
                          Stack trace
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                {this.state.errorCount > 2 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      This error has occurred multiple times. You may need to refresh the page.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
                {process.env.NODE_ENV === 'development' && (
                  <Button
                    onClick={() => window.location.reload()}
                    variant="ghost"
                  >
                    <Bug className="mr-2 h-4 w-4" />
                    Hard Refresh
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Async Error Boundary for handling async errors
interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({
  children,
  fallback,
}) => {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(event.reason));
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const retry = () => {
    setError(null);
  };

  if (error) {
    if (fallback) {
      return <>{fallback(error, retry)}</>;
    }

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-900">Async Error</p>
            <p className="text-sm text-red-700">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Network Error Handler
interface NetworkErrorProps {
  error: Error;
  retry: () => void;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({ error, retry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 text-center"
    >
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
      <p className="text-gray-600 mb-4">
        {error.message || 'Unable to connect to the server. Please check your internet connection.'}
      </p>
      <Button onClick={retry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </motion.div>
  );
};

// Error Recovery Hook
export const useErrorRecovery = () => {
  const [errors, setErrors] = React.useState<Error[]>([]);
  const [isRecovering, setIsRecovering] = React.useState(false);

  const addError = (error: Error) => {
    setErrors(prev => [...prev, error]);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const recover = async (recoveryFn: () => Promise<void>) => {
    setIsRecovering(true);
    try {
      await recoveryFn();
      clearErrors();
    } catch (error) {
      addError(error as Error);
    } finally {
      setIsRecovering(false);
    }
  };

  return {
    errors,
    isRecovering,
    addError,
    clearErrors,
    recover,
  };
};

// Error Toast Component
interface ErrorToastProps {
  error: Error;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onDismiss, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed bottom-4 right-4 max-w-sm bg-white border border-red-200 rounded-lg shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Error</p>
          <p className="text-sm text-gray-600 mt-1">{error.message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      {onRetry && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </motion.div>
  );
};

// Retry Logic Hook
interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
}

export const useRetry = (fn: () => Promise<any>, options: RetryOptions = {}) => {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;
  const [attempts, setAttempts] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const execute = React.useCallback(async () => {
    setIsRetrying(true);
    setError(null);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        setAttempts(i + 1);
        const result = await fn();
        setIsRetrying(false);
        setAttempts(0);
        return result;
      } catch (err) {
        setError(err as Error);
        
        if (i < maxAttempts - 1) {
          const waitTime = backoff ? delay * Math.pow(2, i) : delay;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    setIsRetrying(false);
    throw error;
  }, [fn, maxAttempts, delay, backoff]);

  return {
    execute,
    attempts,
    isRetrying,
    error,
  };
}; 