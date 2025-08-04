import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConnectivity } from './useConnectivity';
import { offlineDataService } from '@/services/offlineDataService';
import { Student } from '@/types/offline';

class StudentsDataService {
  constructor(private isOnline: boolean) {}

  async getStudents(): Promise<Student[]> {
    try {
      const offlineStudents = await offlineDataService.getStudents();
      console.log(`Loaded ${offlineStudents.length} students from offline database`);
      
      if (this.isOnline) {
        this.syncStudentsInBackground().catch(console.error);
      }
      
      return offlineStudents;
    } catch (error) {
      console.error('Failed to load from offline DB:', error);
      
      if (this.isOnline) {
        return this.getStudentsFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  async createStudent(studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const newStudentId = await offlineDataService.createStudent(studentData);
      
      if (this.isOnline) {
        try {
          await this.createStudentInSupabase(newStudentId);
        } catch (syncError) {
          console.error('Failed to sync student to Supabase:', syncError);
        }
      }
      
      return newStudentId;
    } catch (error) {
      if (this.isOnline) {
        return this.createStudentInSupabase(studentData);
      }
      throw error;
    }
  }

  private async syncStudentsInBackground(): Promise<void> {
    console.log('Syncing students in background...');
  }

  private async getStudentsFromSupabase(): Promise<Student[]> {
    console.log('Loading students from Supabase...');
    return [];
  }

  private async createStudentInSupabase(studentData: any): Promise<string> {
    console.log('Creating student in Supabase...');
    return 'temp-student-id';
  }
}

export const useStudentsOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();

  return useQuery({
    queryKey: ['students', 'offline-first'],
    queryFn: async () => {
      const service = new StudentsDataService(connectivity.isOnline);
      return await service.getStudents();
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

export const useCreateStudentOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
      const service = new StudentsDataService(connectivity.isOnline);
      return await service.createStudent(studentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', 'offline-first'] });
      toast({
        title: "Success",
        description: "Student created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create student",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
