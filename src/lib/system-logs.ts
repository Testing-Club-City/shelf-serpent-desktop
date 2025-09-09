
import { supabase } from '@/integrations/supabase/client';

export type SystemLogSeverity = 'info' | 'warning' | 'error' | 'success';

export interface SystemLog {
  id: string;
  created_at: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  user?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface LogOptions {
  action_type: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export const SystemLogs = {
  async create(options: LogOptions): Promise<void> {
    const { error } = await supabase.from('system_logs').insert({
      action_type: options.action_type,
      resource_type: options.resource_type,
      resource_id: options.resource_id || null,
      details: options.details || null,
      ip_address: options.ip_address || null,
      user_agent: options.user_agent || navigator.userAgent
    });

    if (error) {
      console.error('[SystemLogs] Failed to create log:', error);
      throw error;
    }
  },

  async list(): Promise<SystemLog[]> {
    // Get system logs first
    const { data: logsData, error: logsError } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('[SystemLogs] Failed to list logs:', logsError);
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
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('[SystemLogs] Failed to fetch profiles:', profilesError);
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

    // Combine logs with user info and ensure proper typing
    const logsWithUsers: SystemLog[] = logsData.map(log => ({
      id: log.id,
      created_at: log.created_at,
      user_id: log.user_id,
      action_type: log.action_type,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      details: log.details as Record<string, any> | null,
      ip_address: log.ip_address as string | null,
      user_agent: log.user_agent,
      user: log.user_id ? profilesMap.get(log.user_id) : undefined
    }));

    return logsWithUsers;
  },

  async cleanDuplicates(): Promise<void> {
    const { error } = await supabase.rpc('clean_duplicate_logs');

    if (error) {
      console.error('[SystemLogs] Failed to clean duplicates:', error);
      throw error;
    }
  }
};
