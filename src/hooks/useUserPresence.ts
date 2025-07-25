
import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useUserPresence = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const updatePresence = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('[useUserPresence] Auth error:', authError);
        return;
      }

      if (!user) {
        console.warn('[useUserPresence] No authenticated user found');
        return;
      }

      console.log('[useUserPresence] Updating presence for user:', user.id);

      const { error } = await supabase
        .from('profiles')
        .update({
          last_seen: new Date().toISOString(),
          is_online: true
        })
        .eq('id', user.id);

      if (error) {
        console.error('[useUserPresence] Failed to update presence:', error);
      } else {
        console.log('[useUserPresence] Presence updated successfully');
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['user-presence'] });
      }
    } catch (error) {
      console.error('[useUserPresence] Unexpected error:', error);
    }
  }, [isAuthenticated, queryClient]);

  const setOffline = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) return;

      console.log('[useUserPresence] Setting user offline:', user.id);

      await supabase
        .from('profiles')
        .update({ is_online: false })
        .eq('id', user.id);
    } catch (error) {
      console.error('[useUserPresence] Error setting offline:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let updateInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;
    let isSubscribed = true;

    const startPresenceUpdates = () => {
      if (!isSubscribed || !isAuthenticated) return;
      
      console.log('[useUserPresence] Starting presence updates');
      updatePresence();
      updateInterval = setInterval(updatePresence, 10000); // Update every 10 seconds
    };

    const handleConnectionError = () => {
      if (!isSubscribed) return;
      
      console.log('[useUserPresence] Connection error, attempting reconnect');
      clearInterval(updateInterval);
      reconnectTimeout = setTimeout(() => {
        startPresenceUpdates();
      }, 5000); // Try to reconnect after 5 seconds
    };

    const handleVisibilityChange = () => {
      if (!isAuthenticated) return;
      
      if (document.hidden) {
        console.log('[useUserPresence] Page hidden, pausing updates');
        clearInterval(updateInterval);
      } else {
        console.log('[useUserPresence] Page visible, resuming updates');
        startPresenceUpdates();
      }
    };

    const handleBeforeUnload = () => {
      isSubscribed = false;
      setOffline();
    };

    // Start presence updates immediately
    startPresenceUpdates();

    // Set up real-time subscription for profile changes
    const presenceSubscription = supabase
      .channel('profile-presence-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles' 
      }, (payload) => {
        console.log('[useUserPresence] Profile change detected:', payload);
        queryClient.invalidateQueries({ queryKey: ['user-presence'] });
      })
      .subscribe((status) => {
        console.log('[useUserPresence] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[useUserPresence] Successfully subscribed to profile changes');
        } else if (status === 'CLOSED') {
          handleConnectionError();
        }
      });

    // Event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', startPresenceUpdates);
    window.addEventListener('offline', () => {
      console.log('[useUserPresence] Device offline');
      clearInterval(updateInterval);
    });

    return () => {
      isSubscribed = false;
      clearInterval(updateInterval);
      clearTimeout(reconnectTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', startPresenceUpdates);
      window.removeEventListener('offline', () => clearInterval(updateInterval));
      presenceSubscription.unsubscribe();
      setOffline();
    };
  }, [updatePresence, setOffline, queryClient, isAuthenticated]);

  return useQuery({
    queryKey: ['user-presence'],
    queryFn: async () => {
      if (!isAuthenticated) {
        console.log('[useUserPresence] Not authenticated, returning empty array');
        return [];
      }

      console.log('[useUserPresence] Fetching user presence data');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, is_online, last_seen')
        .order('is_online', { ascending: false })
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('[useUserPresence] Error fetching presence:', error);
        throw error;
      }
      
      console.log('[useUserPresence] Fetched presence data:', data?.length, 'users');
      return data || [];
    },
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 3,
    retryDelay: 1000,
  });
};
