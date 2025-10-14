
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

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
    queryKey: ['system-logs', 'local'],
    queryFn: async (): Promise<SystemLogWithUser[]> => {
      console.log('[useSystemLogsQuery] Fetching logs from local database...');
      
      try {
        // Get activity logs from local database using Tauri command
        const logsData = await invoke<any[]>('get_activity_logs', {
          limit: 1000,
        });

        console.log('[useSystemLogsQuery] Received logs:', logsData?.length || 0);

        if (!logsData || logsData.length === 0) {
          console.log('[useSystemLogsQuery] No logs found');
          return [];
        }

        // Transform local database logs to match the expected format
        const logsWithUsers: SystemLogWithUser[] = logsData.map((log: any) => {
          // Parse details if it's a JSON string
          let details = null;
          if (log.details) {
            try {
              details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            } catch (e) {
              console.error('[useSystemLogsQuery] Failed to parse details:', e);
              details = { raw: log.details };
            }
          }

          return {
            id: log.id?.toString() || Math.random().toString(),
            created_at: log.timestamp || log.created_at || new Date().toISOString(),
            user_id: log.user_id || null,
            action_type: log.action || log.action_type || 'unknown',
            resource_type: log.resource_type || log.category || 'system',
            resource_id: log.resource_id || null,
            details: details,
            ip_address: null,
            user_agent: null,
            profiles: log.user_email ? {
              email: log.user_email,
              first_name: log.user_email.split('@')[0],
              last_name: '',
              role: 'user',
            } : undefined,
          };
        });

        console.log('[useSystemLogsQuery] Processed logs:', logsWithUsers.length);
        return logsWithUsers;
      } catch (error) {
        console.error('[useSystemLogsQuery] Failed to fetch logs from local database:', error);
        // Return empty array instead of throwing to prevent UI breaks
        return [];
      }
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};
