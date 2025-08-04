import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConnectivity } from './useConnectivity';
import { offlineDataService } from '@/services/offlineDataService';
import { Staff } from '@/types/offline'; // Staff offline hooks

class StaffDataService {
  constructor(private isOnline: boolean) {}

  async getStaff(): Promise<Staff[]> {
    try {
      const offlineStaff = await offlineDataService.getStaff();
      console.log(`Loaded ${offlineStaff.length} staff from offline database`);
      
      if (this.isOnline) {
        this.syncStaffInBackground().catch(console.error);
      }
      
      return offlineStaff;
    } catch (error) {
      console.error('Failed to load from offline DB:', error);
      
      if (this.isOnline) {
        return this.getStaffFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  async createStaff(staffData: Omit<Staff, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const newStaffId = await offlineDataService.createStaff(staffData);
      
      if (this.isOnline) {
        try {
          await this.createStaffInSupabase(newStaffId);
        } catch (syncError) {
          console.error('Failed to sync staff to Supabase:', syncError);
        }
      }
      
      return newStaffId;
    } catch (error) {
      if (this.isOnline) {
        return this.createStaffInSupabase(staffData);
      }
      throw error;
    }
  }

  private async syncStaffInBackground(): Promise<void> {
    console.log('Syncing staff in background...');
  }

  private async getStaffFromSupabase(): Promise<Staff[]> {
    console.log('Loading staff from Supabase...');
    return [];
  }

  private async createStaffInSupabase(staffData: any): Promise<string> {
    console.log('Creating staff in Supabase...');
    return 'temp-staff-id';
  }
}

export const useStaffOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();

  return useQuery({
    queryKey: ['staff', 'offline-first'],
    queryFn: async () => {
      const service = new StaffDataService(connectivity.isOnline);
      return await service.getStaff();
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

export const useCreateStaffOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffData: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) => {
      const service = new StaffDataService(connectivity.isOnline);
      return await service.createStaff(staffData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'offline-first'] });
      toast({
        title: "Success",
        description: "Staff member created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create staff",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
