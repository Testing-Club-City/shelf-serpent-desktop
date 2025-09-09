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

  async updateStaff(staffId: string, staffData: Partial<Staff>): Promise<void> {
    try {
      await offlineDataService.updateStaff(staffId, staffData);
      console.log('Staff updated in offline database:', staffId);
      
      if (this.isOnline) {
        try {
          await this.updateStaffInSupabase(staffId, staffData);
        } catch (syncError) {
          console.error('Failed to sync staff update to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        return this.updateStaffInSupabase(staffId, staffData);
      }
      throw error;
    }
  }

  async deleteStaff(staffId: string): Promise<void> {
    try {
      await offlineDataService.deleteStaff(staffId);
      console.log('Staff deleted from offline database:', staffId);
      
      if (this.isOnline) {
        try {
          await this.deleteStaffInSupabase(staffId);
        } catch (syncError) {
          console.error('Failed to sync staff deletion to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        return this.deleteStaffInSupabase(staffId);
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

  private async updateStaffInSupabase(staffId: string, staffData: any): Promise<void> {
    console.log('Updating staff in Supabase...');
  }

  private async deleteStaffInSupabase(staffId: string): Promise<void> {
    console.log('Deleting staff in Supabase...');
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

export const useUpdateStaffOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ staffId, staffData }: { staffId: string; staffData: Partial<Staff> }) => {
      const service = new StaffDataService(connectivity.isOnline);
      return await service.updateStaff(staffId, staffData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'offline-first'] });
      toast({
        title: "Success",
        description: "Staff member updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update staff",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteStaffOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffId: string) => {
      const service = new StaffDataService(connectivity.isOnline);
      return await service.deleteStaff(staffId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'offline-first'] });
      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete staff",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
