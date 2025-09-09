
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import React from 'react';

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const useSystemSettings = () => {
  const { isAuthenticated, isOnline } = useOfflineAuth();
  
  const queryClient = useQueryClient();
  
  // Provide instant default data to prevent any loading delays
  const defaultSettings: SystemSetting[] = [
    {
      id: 'instant-default',
      setting_key: 'school_name',
      setting_value: 'Library Management System',
      description: 'Instant default for fast loading',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const query = useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SystemSetting[]> => {
      console.log('⚡ Ultra-fast system settings fetch...');
      
      // If offline, return default settings immediately
      if (!isOnline) {
        console.log('⚡ Offline - instant defaults');
        return defaultSettings;
      }
      
      try {
        // Super aggressive timeout for speed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('⚡ Settings timeout - using defaults');
          controller.abort();
        }, 800); // Ultra-short 800ms timeout
        
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .order('setting_key')
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          console.log('⚡ Settings error - using defaults');
          return defaultSettings;
        }

        console.log('⚡ Settings fetched successfully');
        const settings: SystemSetting[] = (data || []).map(setting => ({
          ...setting,
          setting_value: typeof setting.setting_value === 'string' 
            ? setting.setting_value 
            : JSON.stringify(setting.setting_value),
          description: setting.description || undefined
        }));

        return settings;
      } catch (error) {
        console.log('⚡ Settings fetch failed - using defaults (this is fine)');
        return defaultSettings;
      }
    },
    // Ultra-fast loading options
    placeholderData: defaultSettings, // Show defaults immediately
    staleTime: 10 * 60 * 1000, // 10 minutes - keep data longer
    refetchOnWindowFocus: false, // No unnecessary refetches
    refetchOnMount: false, // No mount refetch for speed
    refetchOnReconnect: false, // No reconnect refetch
    enabled: true, // Always available
    refetchInterval: false, // No auto-refetching
    retry: 0, // No retries for speed - use defaults instead
    retryDelay: 0
  });

  // Add a function to manually refetch settings
  const refetchSettings = React.useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ['system-settings'] });
  }, [queryClient]);

  return {
    ...query,
    refetch: refetchSettings
  };
};

export const useUpdateSystemSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: any; description?: string }) => {
      console.log('Updating system setting:', key, '=', value);
      console.log('Value type:', typeof value);
      
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: key,
          setting_value: typeof value === 'string' ? value : JSON.stringify(value),
          description: description || null,
        }, {
          onConflict: 'setting_key'  // Specify the conflict column for upsert
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating setting:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('Setting updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
  });
};

export const getSchoolNameFromSettings = (settings: SystemSetting[]): string => {
  console.log('Getting school name from settings:', settings);
  
  if (!settings || settings.length === 0) {
    console.log('No system settings found, using default');
    return 'Library Management System';
  }
  
  const schoolNameSetting = settings.find(s => s.setting_key === 'school_name');
  const institutionNameSetting = settings.find(s => s.setting_key === 'institution_name');
  
  const schoolName = schoolNameSetting?.setting_value || institutionNameSetting?.setting_value || 'Library Management System';
  console.log('Found school name:', schoolName);
  
  return schoolName;
};
