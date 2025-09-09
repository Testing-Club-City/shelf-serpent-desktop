
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_id: string;
  related_id: string | null;
}

export const useNotifications = () => {
  const { user } = useOfflineAuth();
  
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to mark notification as read: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useOfflineAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user found');
      
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to mark notifications as read: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (notification: {
      user_id: string;
      title: string;
      message: string;
      type: string;
      related_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Success',
        description: 'Notification created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create notification: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
