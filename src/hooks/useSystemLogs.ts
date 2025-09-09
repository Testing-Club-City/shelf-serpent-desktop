import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import type { LogSystemEventArgs } from '@/types/system-logs';

type LogOptions = Database['public']['Functions']['log_system_event']['Args'];

export const useSystemLogs = () => {
  const logEvent = useCallback(async (options: LogOptions): Promise<void> => {
    try {
      const { error } = await supabase.rpc('log_system_event', options);

      if (error) {
        console.error('[useSystemLogs] Failed to log event:', error);
        throw error;
      }
    } catch (error) {
      console.error('[useSystemLogs] Unexpected error:', error);
      throw error;
    }
  }, []);

  return {
    logAction: (action: string, resource: string, details?: any, resourceId?: string | null) => 
      logEvent({ 
        p_action_type: action, 
        p_resource_type: resource, 
        p_resource_id: resourceId || null, 
        p_details: details || null 
      }),
    
    logUserAction: (action: string, resource: string, details?: any, resourceId?: string | null) => 
      logEvent({ 
        p_action_type: action, 
        p_resource_type: resource, 
        p_resource_id: resourceId || null, 
        p_details: details || null,
        p_user_agent: navigator.userAgent
      }),
    
    logSystemAction: (action: string, resource: string, details?: any, resourceId?: string | null) => 
      logEvent({ 
        p_action_type: action, 
        p_resource_type: resource, 
        p_resource_id: resourceId || null, 
        p_details: details || null,
        p_user_agent: 'system'
      }),
    
    logError: (error: Error, resource: string, resourceId?: string | null) => 
      logEvent({ 
        p_action_type: 'error', 
        p_resource_type: resource, 
        p_resource_id: resourceId || null, 
        p_details: {
          message: error.message,
          stack: error.stack
        },
        p_user_agent: navigator.userAgent
      })
  };
};

// Enhanced logging function with deduplication
export const useCreateSystemLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      action_type, 
      resource_type, 
      resource_id, 
      details 
    }: { 
      action_type: string; 
      resource_type: string; 
      resource_id?: string; 
      details?: any; 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Create a unique identifier for this log entry to prevent duplicates
      const logIdentifier = `${user.id}-${action_type}-${resource_type}-${resource_id || 'no-id'}-${Date.now()}`;
      
      // Check for recent duplicate logs (within last 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      const { data: recentLogs } = await supabase
        .from('system_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('action_type', action_type)
        .eq('resource_type', resource_type)
        .eq('resource_id', resource_id)
        .gte('created_at', fiveSecondsAgo);

      // If we find a recent duplicate, don't create another log
      if (recentLogs && recentLogs.length > 0) {
        console.log('Duplicate log prevented:', { action_type, resource_type, resource_id });
        return recentLogs[0];
      }

      // Clean and prepare details
      const cleanDetails = details ? {
        ...details,
        log_identifier: logIdentifier,
        timestamp: new Date().toISOString()
      } : {
        log_identifier: logIdentifier,
        timestamp: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('system_logs')
        .insert({
          user_id: user.id,
          action_type,
          resource_type,
          resource_id: resource_id || null,
          details: cleanDetails,
          ip_address: null, // Can be enhanced to capture real IP
          user_agent: navigator.userAgent
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create system log:', error);
        throw error;
      }

      console.log('System log created successfully:', {
        action_type,
        resource_type,
        resource_id,
        user_id: user.id
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
    },
    onError: (error) => {
      console.error('System logging failed:', error);
      // Don't show user-facing errors for logging failures
      // as they shouldn't interrupt the main functionality
    }
  });
};

// Helper function to log common activities
export const logActivity = async (
  action_type: string,
  resource_type: string,
  resource_id?: string,
  details?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.id) {
      console.warn('Cannot log activity: User not authenticated');
      return;
    }

    // Create a more specific identifier to prevent duplicates
    const now = Date.now();
    const logHash = `${user.id}-${action_type}-${resource_type}-${resource_id || 'none'}-${Math.floor(now / 1000)}`;
    
    // Check for recent duplicate within the same second
    const oneSecondAgo = new Date(now - 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from('system_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('action_type', action_type)
      .eq('resource_type', resource_type)
      .gte('created_at', oneSecondAgo);

    if (recentLogs && recentLogs.length > 0) {
      console.log('Preventing duplicate log entry');
      return;
    }

    const logEntry = {
      user_id: user.id,
      action_type,
      resource_type,
      resource_id: resource_id || null,
      details: details ? {
        ...details,
        log_hash: logHash,
        client_timestamp: new Date().toISOString()
      } : {
        log_hash: logHash,
        client_timestamp: new Date().toISOString()
      },
      user_agent: navigator.userAgent
    };

    const { error } = await supabase
      .from('system_logs')
      .insert(logEntry);

    if (error) {
      console.error('Failed to log activity:', error);
    } else {
      console.log('Activity logged successfully:', { action_type, resource_type });
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
};
