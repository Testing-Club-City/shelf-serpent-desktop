
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
  const { isAuthenticated } = useOfflineAuth();
  
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SystemSetting[]> => {
      console.log('Fetching system settings...');
      
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .order('setting_key')
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          console.error('System settings error:', error);
          throw error;
        }

        // Convert Json setting_value to string to match the interface
        const settings: SystemSetting[] = (data || []).map(setting => ({
          ...setting,
          setting_value: typeof setting.setting_value === 'string' 
            ? setting.setting_value 
            : JSON.stringify(setting.setting_value),
          description: setting.description || undefined
        }));

        return settings;
      } catch (error) {
        console.error('Error fetching system settings:', error);
        // Return default settings to prevent hanging
        return [
          {
            id: 'default-1',
            setting_key: 'school_name',
            setting_value: 'Library Management System',
            description: 'Default school name',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      }
    },
    // Add stale time and refetch options
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Reduce unnecessary refetches
    refetchOnMount: false, // Don't refetch on mount for faster loading
    refetchOnReconnect: true,
    // Always enable the query - system settings like school name should be available even on login page
    enabled: true,
    refetchInterval: false, // Disable automatic refetching
    retry: 1, // Only retry once
    retryDelay: 1000, // 1 second delay between retries
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
