
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemLogWithUser {
  id: string;
  created_at: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  profiles?: {
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

export const useSystemLogsQuery = () => {
  return useQuery({
    queryKey: ['system-logs'],
    queryFn: async (): Promise<SystemLogWithUser[]> => {
      // First get system logs
      const { data: logsData, error: logsError } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error('[useSystemLogsQuery] Failed to fetch logs:', logsError);
        throw logsError;
      }

      if (!logsData || logsData.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(logsData.map(log => log.user_id).filter(Boolean))];
      
      let profilesData = [];
      if (userIds.length > 0) {
        // Get profiles for those users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, role')
          .in('id', userIds);

        if (profilesError) {
          console.error('[useSystemLogsQuery] Failed to fetch profiles:', profilesError);
          // Don't throw error, just continue without profiles
        } else {
          profilesData = profiles || [];
        }
      }

      // Create a map of profiles by user ID
      const profilesMap = new Map();
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Combine logs with profiles and ensure proper typing
      const logsWithUsers: SystemLogWithUser[] = logsData.map(log => ({
        id: log.id,
        created_at: log.created_at,
        user_id: log.user_id,
        action_type: log.action_type,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        details: log.details as Record<string, any> | null,
        ip_address: log.ip_address as string | null,
        user_agent: log.user_agent,
        profiles: log.user_id ? profilesMap.get(log.user_id) : undefined
      }));

      return logsWithUsers;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};
