import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ActivityLoggerService } from '@/hooks/useActivityLogger';

interface ActivityLoggingContextType {
  logPageView: (pageName: string, metadata?: Record<string, any>) => Promise<void>;
  logUserAction: (action: string, component?: string, metadata?: Record<string, any>) => Promise<void>;
  logError: (error: Error, context?: string, metadata?: Record<string, any>) => Promise<void>;
}

const ActivityLoggingContext = createContext<ActivityLoggingContextType | null>(null);

interface ActivityLoggingProviderProps {
  children: ReactNode;
  userId?: string;
  userEmail?: string;
  enablePageTracking?: boolean;
  enableErrorTracking?: boolean;
  enablePerformanceTracking?: boolean;
}

export const ActivityLoggingProvider: React.FC<ActivityLoggingProviderProps> = ({
  children,
  userId,
  userEmail,
  enablePageTracking = true,
  enableErrorTracking = true,
  enablePerformanceTracking = true,
}) => {
  const location = useLocation();

  // Track page views
  useEffect(() => {
    if (!enablePageTracking) return;

    const pageName = location.pathname;
    const pageTitle = document.title;
    
    ActivityLoggerService.logUI('Page View', pageName, userId, {
      page_title: pageTitle,
      page_path: pageName,
      page_search: location.search,
      page_hash: location.hash,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }, [location, userId, enablePageTracking]);

  // Global error tracking
  useEffect(() => {
    if (!enableErrorTracking) return;

    const handleError = (event: ErrorEvent) => {
      ActivityLoggerService.logError(
        new Error(event.message),
        'Global Error Handler',
        'Window Error',
        userId,
        {
          filename: event.filename,
          line_number: event.lineno,
          column_number: event.colno,
          page_url: window.location.href,
          user_agent: navigator.userAgent
        }
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
        
      ActivityLoggerService.logError(
        error,
        'Global Error Handler',
        'Unhandled Promise Rejection',
        userId,
        {
          page_url: window.location.href,
          user_agent: navigator.userAgent
        }
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [userId, enableErrorTracking]);

  // Performance tracking for app lifecycle
  useEffect(() => {
    if (!enablePerformanceTracking) return;

    // Track app load time
    const handleLoad = () => {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        ActivityLoggerService.logPerformance(
          'App Load',
          navigationTiming.loadEventEnd - navigationTiming.fetchStart,
          'Application',
          {
            dom_content_loaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.fetchStart,
            dom_interactive: navigationTiming.domInteractive - navigationTiming.fetchStart,
            first_paint: 'N/A', // Would need Paint Timing API
            navigation_type: navigationTiming.type
          }
        );
      }
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [enablePerformanceTracking]);

  const contextValue: ActivityLoggingContextType = {
    logPageView: async (pageName: string, metadata?: Record<string, any>) => {
      return ActivityLoggerService.logUI('Manual Page View', pageName, userId, {
        ...metadata,
        user_email: userEmail,
        timestamp: new Date().toISOString()
      });
    },

    logUserAction: async (action: string, component?: string, metadata?: Record<string, any>) => {
      return ActivityLoggerService.logUI(action, component, userId, {
        ...metadata,
        user_email: userEmail,
        page_url: window.location.href,
        timestamp: new Date().toISOString()
      });
    },

    logError: async (error: Error, context?: string, metadata?: Record<string, any>) => {
      return ActivityLoggerService.logError(
        error, 
        context || 'User Action', 
        'Error Occurred',
        userId, 
        {
          ...metadata,
          user_email: userEmail,
          page_url: window.location.href
        }
      );
    }
  };

  return (
    <ActivityLoggingContext.Provider value={contextValue}>
      {children}
    </ActivityLoggingContext.Provider>
  );
};

export const useActivityLogging = () => {
  const context = useContext(ActivityLoggingContext);
  if (!context) {
    throw new Error('useActivityLogging must be used within an ActivityLoggingProvider');
  }
  return context;
};

/**
 * Higher-order component for automatic component tracking
 */
export function withComponentLogging<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  componentName: string,
  trackInteractions: boolean = false
) {
  const ComponentWithLogging = (props: T) => {
    const { logUserAction } = useActivityLogging();

    useEffect(() => {
      logUserAction('Component Mount', componentName);
      
      return () => {
        logUserAction('Component Unmount', componentName);
      };
    }, [logUserAction]);

    // Enhanced props with logging for interactions
    const enhancedProps = trackInteractions ? {
      ...props,
      onClick: (event: React.MouseEvent) => {
        logUserAction('Click', componentName, {
          element_type: event.currentTarget.tagName,
          element_id: event.currentTarget.id,
          element_class: event.currentTarget.className
        });
        
        // Call original onClick if it exists
        if ('onClick' in props && typeof props.onClick === 'function') {
          (props.onClick as Function)(event);
        }
      },
      onSubmit: (event: React.FormEvent) => {
        logUserAction('Form Submit', componentName, {
          form_id: event.currentTarget.id,
          form_class: event.currentTarget.className
        });
        
        // Call original onSubmit if it exists
        if ('onSubmit' in props && typeof props.onSubmit === 'function') {
          (props.onSubmit as Function)(event);
        }
      }
    } : props;

    return React.createElement(WrappedComponent, enhancedProps as T);
  };

  ComponentWithLogging.displayName = `withLogging(${componentName})`;
  return ComponentWithLogging;
}

/**
 * Hook for logging form interactions
 */
export function useFormLogging(formName: string) {
  const { logUserAction } = useActivityLogging();

  return {
    logFieldChange: (fieldName: string, value: any) => {
      logUserAction('Field Change', formName, {
        field_name: fieldName,
        field_value_type: typeof value,
        field_value_length: typeof value === 'string' ? value.length : undefined
      });
    },
    
    logFormSubmit: (formData: Record<string, any>) => {
      logUserAction('Form Submit', formName, {
        field_count: Object.keys(formData).length,
        form_fields: Object.keys(formData)
      });
    },
    
    logFormError: (error: Error, fieldName?: string) => {
      logUserAction('Form Error', formName, {
        error_message: error.message,
        field_name: fieldName,
        error_type: error.constructor.name
      });
    }
  };
}

/**
 * Hook for logging API calls
 */
export function useApiLogging() {
  const { logUserAction } = useActivityLogging();

  const logApiCall = async function <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET',
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      ActivityLoggerService.logPerformance(
        `API Call: ${method} ${endpoint}`,
        duration,
        'API',
        {
          ...metadata,
          method,
          endpoint,
          status: 'success'
        }
      );
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      ActivityLoggerService.logError(
        error instanceof Error ? error : new Error(String(error)),
        'API',
        'API Call Failed',
        undefined,
        {
          ...metadata,
          method,
          endpoint,
          duration,
          status: 'error'
        }
      );
      
      throw error;
    }
  };

  return { logApiCall };
}
