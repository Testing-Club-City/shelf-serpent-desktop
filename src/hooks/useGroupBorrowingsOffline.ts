import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineDataService } from '@/services/offlineDataService';
import { useToast } from '@/hooks/use-toast';
import { useConnectivity } from '@/hooks/useConnectivity';
import { supabase } from '@/integrations/supabase/client';

interface GroupBorrowing {
  id: string;
  book_id: string;
  book_copy_id: string;
  tracking_code: string;
  borrowed_date: string;
  due_date: string;
  returned_date?: string;
  condition_at_issue: string;
  condition_at_return?: string;
  fine_amount?: number;
  fine_paid?: boolean;
  notes?: string;
  return_notes?: string;
  status: string;
  is_lost?: boolean;
  student_count: number;
  student_ids: string[];
  issued_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  books?: any;
  book_copies?: any;
}

// Group Borrowings data service
class GroupBorrowingsDataService {
  private isOnline: boolean = false;

  constructor(private connectivity: ReturnType<typeof useConnectivity>) {
    this.isOnline = connectivity.isOnline;
  }

  async getGroupBorrowings(): Promise<GroupBorrowing[]> {
    try {
      const offlineGroupBorrowings = await offlineDataService.getGroupBorrowings();
      console.log(`Loaded ${offlineGroupBorrowings.length} group borrowings from offline database`);
      
      if (this.isOnline) {
        this.syncGroupBorrowingsInBackground().catch(console.error);
      }
      
      return offlineGroupBorrowings;
    } catch (error) {
      console.error('Failed to get group borrowings:', error);
      throw error;
    }
  }

  private async syncGroupBorrowingsInBackground(): Promise<void> {
    try {
      const { data: remoteGroupBorrowings, error } = await supabase
        .from('group_borrowings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      for (const groupBorrowingData of remoteGroupBorrowings || []) {
        try {
          await offlineDataService.upsertGroupBorrowing(groupBorrowingData);
        } catch (error) {
          console.error(`Failed to sync group borrowing ${groupBorrowingData.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async createGroupBorrowing(groupBorrowingData: any): Promise<string> {
    try {
      const groupBorrowingId = await offlineDataService.createGroupBorrowing(groupBorrowingData);
      console.log('Group borrowing created in offline database:', groupBorrowingId);

      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('group_borrowings')
            .insert(groupBorrowingData)
            .select()
            .single();

          if (error) throw error;
          console.log('Group borrowing synced to Supabase');
          return data.id || groupBorrowingId;
        } catch (syncError) {
          console.error('Failed to sync group borrowing to Supabase:', syncError);
        }
      }

      return groupBorrowingId;
    } catch (error) {
      console.error('Failed to create group borrowing:', error);
      throw error;
    }
  }

  async updateGroupBorrowing(groupBorrowingId: string, groupBorrowingData: any): Promise<void> {
    try {
      await offlineDataService.updateGroupBorrowing(groupBorrowingId, groupBorrowingData);
      console.log('Group borrowing updated in offline database:', groupBorrowingId);

      if (this.isOnline) {
        try {
          const { error } = await supabase
            .from('group_borrowings')
            .update(groupBorrowingData)
            .eq('id', groupBorrowingId);

          if (error) throw error;
          console.log('Group borrowing update synced to Supabase');
        } catch (syncError) {
          console.error('Failed to sync group borrowing update to Supabase:', syncError);
        }
      }
    } catch (error) {
      console.error('Failed to update group borrowing:', error);
      throw error;
    }
  }

  async returnGroupBorrowing(groupBorrowingId: string, returnData: any): Promise<void> {
    try {
      await offlineDataService.returnGroupBorrowing(groupBorrowingId, returnData);
      console.log('Group borrowing returned in offline database:', groupBorrowingId);

      if (this.isOnline) {
        try {
          const { error } = await supabase
            .from('group_borrowings')
            .update({
              returned_date: returnData.returned_date,
              condition_at_return: returnData.condition_at_return,
              return_notes: returnData.return_notes,
              status: 'returned',
              returned_by: returnData.returned_by
            })
            .eq('id', groupBorrowingId);

          if (error) throw error;
          console.log('Group borrowing return synced to Supabase');
        } catch (syncError) {
          console.error('Failed to sync group borrowing return to Supabase:', syncError);
        }
      }
    } catch (error) {
      console.error('Failed to return group borrowing:', error);
      throw error;
    }
  }
}

// React hooks
export const useGroupBorrowingsOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['group-borrowings', 'offline-first'],
    queryFn: async () => {
      const service = new GroupBorrowingsDataService(connectivity);
      return await service.getGroupBorrowings();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (!connectivity.isOnline && failureCount < 2) {
        return true;
      }
      return failureCount < 1;
    },
  });
};

export const useCreateGroupBorrowingOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupBorrowingData: any) => {
      const service = new GroupBorrowingsDataService(connectivity);
      return await service.createGroupBorrowing(groupBorrowingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-borrowings', 'offline-first'] });
      toast({
        title: "Group borrowing created",
        description: "Group borrowing saved to offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create group borrowing",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useReturnGroupBorrowingOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupBorrowingId, returnData }: { groupBorrowingId: string; returnData: any }) => {
      const service = new GroupBorrowingsDataService(connectivity);
      return await service.returnGroupBorrowing(groupBorrowingId, returnData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-borrowings', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      toast({
        title: "Group borrowing returned",
        description: "Group borrowing return processed in offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to return group borrowing",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
