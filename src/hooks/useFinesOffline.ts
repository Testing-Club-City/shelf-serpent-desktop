import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConnectivity } from './useConnectivity';
import { offlineDataService } from '@/services/offlineDataService';
import { FineWithDetails } from '@/types/offline';

class FinesDataService {
  constructor(private isOnline: boolean) {}

  async getFines(): Promise<FineWithDetails[]> {
    try {
      const offlineFines = await offlineDataService.getFines();
      console.log(`Loaded ${offlineFines.length} fines from offline database`);
      
      if (this.isOnline) {
        this.syncFinesInBackground().catch(console.error);
      }
      
      return offlineFines;
    } catch (error) {
      console.error('Failed to load from offline DB:', error);
      
      if (this.isOnline) {
        return this.getFinesFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  async createFine(fineData: {
    borrowing_id: string;
    student_id: string;
    amount: number;
    reason: string;
  }): Promise<string> {
    try {
      const newFineId = await offlineDataService.createFine(fineData);
      
      if (this.isOnline) {
        try {
          await this.createFineInSupabase(fineData);
        } catch (syncError) {
          console.error('Failed to sync fine to Supabase:', syncError);
        }
      }
      
      return newFineId;
    } catch (error) {
      if (this.isOnline) {
        return this.createFineInSupabase(fineData);
      }
      throw error;
    }
  }

  async payFine(fineId: string): Promise<void> {
    try {
      await offlineDataService.payFine(fineId, { paid_date: new Date().toISOString(), amount_paid: 0 });
      
      if (this.isOnline) {
        try {
          await this.payFineInSupabase(fineId);
        } catch (syncError) {
          console.error('Failed to sync fine payment to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        await this.payFineInSupabase(fineId);
      }
      throw error;
    }
  }

  private async syncFinesInBackground(): Promise<void> {
    console.log('Syncing fines in background...');
  }

  private async getFinesFromSupabase(): Promise<FineWithDetails[]> {
    console.log('Loading fines from Supabase...');
    return [];
  }

  private async createFineInSupabase(fineData: any): Promise<string> {
    console.log('Creating fine in Supabase...');
    return 'temp-fine-id';
  }

  private async updateFineInSupabase(fine: FineWithDetails): Promise<string> {
    console.log('Updating fine in Supabase...');
    return 'temp-fine-id';
  }

  private async payFineInSupabase(fineId: string): Promise<string> {
    console.log('Paying fine in Supabase...');
    return 'temp-fine-id';
  }
}

export const useFinesOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();

  return useQuery({
    queryKey: ['fines', 'offline-first'],
    queryFn: async () => {
      const service = new FinesDataService(connectivity.isOnline);
      return await service.getFines();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (!connectivity.isOnline && failureCount < 2) {
        return true;
      }
      return failureCount < 1;
    },
  });
};

export const useCreateFineOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fineData: {
      borrowing_id: string;
      student_id: string;
      amount: number;
      reason: string;
    }) => {
      const service = new FinesDataService(connectivity.isOnline);
      return await service.createFine(fineData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      toast({
        title: "Success",
        description: "Fine created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create fine",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const usePayFineOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fineId: string) => {
      const service = new FinesDataService(connectivity.isOnline);
      return await service.payFine(fineId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      toast({
        title: "Success",
        description: "Fine paid successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to pay fine",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
