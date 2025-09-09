import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  user_id?: string;
  user_email?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
  source_file?: string;
  source_line?: number;
}

export interface ActivityLogStats {
  log_file_path: string;
  file_exists: boolean;
  file_size_bytes?: number;
  file_size_mb?: number;
  backup_files: Array<{
    path: string;
    size_bytes: number;
    size_mb: number;
  }>;
}

export interface SimpleLogOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  action: string;
  user_id?: string;
  user_email?: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any>;
}

/**
 * Hook for activity logging functionality
 */
export const useActivityLogger = () => {
  const queryClient = useQueryClient();

  // Initialize activity logger
  const initLogger = useMutation({
    mutationFn: async (logDir: string) => {
      return await invoke<string>('init_activity_logger', { logDir });
    }
  });

  // Log a simple activity
  const logActivity = useMutation({
    mutationFn: async (options: SimpleLogOptions) => {
      return await invoke<void>('log_simple_activity', {
        level: options.level || 'info',
        category: options.category,
        action: options.action,
        userId: options.user_id,
        userEmail: options.user_email,
        resourceType: options.resource_type,
        resourceId: options.resource_id,
        details: options.details,
      });
    },
    onSuccess: () => {
      // Invalidate activity logs query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    }
  });

  // Log a complete activity entry
  const logEntry = useMutation({
    mutationFn: async (entry: ActivityLogEntry) => {
      return await invoke<void>('log_activity_entry', { entryData: entry });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    }
  });

  // Get activity logs
  const getLogs = (limit?: number) => useQuery({
    queryKey: ['activity-logs', limit],
    queryFn: async () => {
      return await invoke<ActivityLogEntry[]>('get_activity_logs', { limit });
    }
  });

  // Get activity log statistics
  const getStats = useQuery({
    queryKey: ['activity-log-stats'],
    queryFn: async () => {
      return await invoke<ActivityLogStats>('get_activity_log_stats');
    }
  });

  // Export activity logs
  const exportLogs = useMutation({
    mutationFn: async ({ exportPath, limit }: { exportPath: string; limit?: number }) => {
      return await invoke<string>('export_activity_logs', { exportPath, limit });
    }
  });

  // Clear activity logs
  const clearLogs = useMutation({
    mutationFn: async (createBackup: boolean = true) => {
      return await invoke<string>('clear_activity_logs', { createBackup });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['activity-log-stats'] });
    }
  });

  return {
    initLogger,
    logActivity,
    logEntry,
    getLogs,
    getStats,
    exportLogs,
    clearLogs,
  };
};

/**
 * Convenience functions for common logging patterns
 */
export class ActivityLoggerService {
  /**
   * Log user authentication events
   */
  static async logAuth(action: 'login' | 'logout' | 'session_expired' | 'password_change', 
                       userId?: string, userEmail?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'info',
      category: 'Authentication',
      action: action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      userId,
      userEmail,
      details
    });
  }

  /**
   * Log database operations
   */
  static async logDatabase(action: string, resourceType: string, resourceId?: string, 
                          userId?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'info',
      category: 'Database',
      action,
      resourceType,
      resourceId,
      userId,
      details
    });
  }

  /**
   * Log sync operations
   */
  static async logSync(action: 'sync_start' | 'sync_complete' | 'sync_error' | 'connectivity_check',
                       details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: action === 'sync_error' ? 'error' : 'info',
      category: 'Sync',
      action: action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      details
    });
  }

  /**
   * Log user interface interactions
   */
  static async logUI(action: string, component?: string, userId?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'debug',
      category: 'UI',
      action,
      resourceType: component,
      userId,
      details
    });
  }

  /**
   * Log errors with stack trace
   */
  static async logError(error: Error, category: string, action: string, 
                       userId?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'error',
      category,
      action,
      userId,
      details: {
        ...details,
        error_message: error.message,
        stack_trace: error.stack,
        error_name: error.name
      }
    });
  }

  /**
   * Log performance metrics
   */
  static async logPerformance(action: string, durationMs: number, 
                             resourceType?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'debug',
      category: 'Performance',
      action,
      resourceType,
      details: {
        ...details,
        duration_ms: durationMs,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log security events
   */
  static async logSecurity(action: string, userId?: string, ipAddress?: string, 
                          userAgent?: string, details?: Record<string, any>) {
    return invoke<void>('log_simple_activity', {
      level: 'warn',
      category: 'Security',
      action,
      userId,
      details: {
        ...details,
        ip_address: ipAddress,
        user_agent: userAgent,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Higher-order component to automatically log component lifecycle
 */
export function withActivityLogging<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  componentName: string
) {
  return function ActivityLoggedComponent(props: T) {
    React.useEffect(() => {
      ActivityLoggerService.logUI('Component Mount', componentName);
      
      return () => {
        ActivityLoggerService.logUI('Component Unmount', componentName);
      };
    }, []);

    return React.createElement(WrappedComponent, props);
  };
}

/**
 * Performance monitoring hook
 */
export function usePerformanceLogger(actionName: string, dependencies: any[] = []) {
  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      ActivityLoggerService.logPerformance(actionName, duration);
    };
  }, dependencies);
}
