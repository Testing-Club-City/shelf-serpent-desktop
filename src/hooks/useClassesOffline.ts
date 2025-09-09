import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineDataService } from '@/services/offlineDataService';
import { useToast } from '@/hooks/use-toast';
import { useConnectivity } from '@/hooks/useConnectivity';
import { supabase } from '@/integrations/supabase/client';

interface Class {
  id: string;
  name: string;
  description?: string;
  teacher_name?: string;
  grade_level?: string;
  academic_year?: string;
  created_at?: string;
  updated_at?: string;
}

// Classes data service
class ClassesDataService {
  private isOnline: boolean = false;

  constructor(private connectivity: ReturnType<typeof useConnectivity>) {
    this.isOnline = connectivity.isOnline;
  }

  async getClasses(): Promise<Class[]> {
    try {
      const offlineClasses = await offlineDataService.getClasses();
      console.log(`Loaded ${offlineClasses.length} classes from offline database`);
      
      if (this.isOnline) {
        this.syncClassesInBackground().catch(console.error);
      }
      
      return offlineClasses;
    } catch (error) {
      console.error('Failed to get classes:', error);
      throw error;
    }
  }

  private async syncClassesInBackground(): Promise<void> {
    try {
      const { data: remoteClasses, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      for (const classData of remoteClasses || []) {
        try {
          await offlineDataService.upsertClass(classData);
        } catch (error) {
          console.error(`Failed to sync class ${classData.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async createClass(classData: any): Promise<string> {
    try {
      const classId = await offlineDataService.createClass(classData);
      console.log('Class created in offline database:', classId);

      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('classes')
            .insert(classData)
            .select()
            .single();

          if (error) throw error;
          console.log('Class synced to Supabase');
          return data.id || classId;
        } catch (syncError) {
          console.error('Failed to sync class to Supabase:', syncError);
        }
      }

      return classId;
    } catch (error) {
      console.error('Failed to create class:', error);
      throw error;
    }
  }

  async updateClass(classId: string, classData: any): Promise<void> {
    try {
      await offlineDataService.updateClass(classId, classData);
      console.log('Class updated in offline database:', classId);

      if (this.isOnline) {
        try {
          const { error } = await supabase
            .from('classes')
            .update(classData)
            .eq('id', classId);

          if (error) throw error;
          console.log('Class update synced to Supabase');
        } catch (syncError) {
          console.error('Failed to sync class update to Supabase:', syncError);
        }
      }
    } catch (error) {
      console.error('Failed to update class:', error);
      throw error;
    }
  }

  async deleteClass(classId: string): Promise<void> {
    try {
      await offlineDataService.deleteClass(classId);
      console.log('Class deleted from offline database:', classId);

      if (this.isOnline) {
        try {
          const { error } = await supabase
            .from('classes')
            .delete()
            .eq('id', classId);

          if (error) throw error;
          console.log('Class deletion synced to Supabase');
        } catch (syncError) {
          console.error('Failed to sync class deletion to Supabase:', syncError);
        }
      }
    } catch (error) {
      console.error('Failed to delete class:', error);
      throw error;
    }
  }
}

// React hooks
export const useClassesOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['classes', 'offline-first'],
    queryFn: async () => {
      const service = new ClassesDataService(connectivity);
      return await service.getClasses();
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

export const useCreateClassOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classData: any) => {
      const service = new ClassesDataService(connectivity);
      return await service.createClass(classData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'offline-first'] });
      toast({
        title: "Class created",
        description: "Class saved to offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create class",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateClassOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, classData }: { classId: string; classData: any }) => {
      const service = new ClassesDataService(connectivity);
      return await service.updateClass(classId, classData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'offline-first'] });
      toast({
        title: "Class updated",
        description: "Class updated in offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update class",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteClassOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classId: string) => {
      const service = new ClassesDataService(connectivity);
      return await service.deleteClass(classId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'offline-first'] });
      toast({
        title: "Class deleted",
        description: "Class deleted from offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete class",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
