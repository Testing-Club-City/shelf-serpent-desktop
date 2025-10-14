import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConnectivity } from './useConnectivity';
import { offlineDataService } from '@/services/offlineDataService';
import { Student, StudentWithClass } from '@/types/offline';
import { logStudent } from '@/lib/activityLogger';

class StudentsDataService {
  constructor(private isOnline: boolean) {}

  async getStudents(): Promise<StudentWithClass[]> {
    try {
      // Use the existing method - it already includes class relationships via JOIN
      const offlineStudents = await offlineDataService.getStudents();
      console.log(`Loaded ${offlineStudents.length} students with class information from offline database`);
      
      // Transform Student[] to StudentWithClass[] - the class_grade field already contains the class name
      const studentsWithClasses: StudentWithClass[] = offlineStudents.map(student => ({
        ...student,
        classes: student.class_grade !== 'Unknown' ? { class_name: student.class_grade } : null
      }));
      
      if (this.isOnline) {
        this.syncStudentsInBackground().catch(console.error);
      }
      
      return studentsWithClasses;
    } catch (error) {
      console.error('Failed to load students with classes from offline DB, falling back to basic students:', error);
      
      try {
        // Fallback to basic students without class relationships
        const basicStudents = await offlineDataService.getStudents();
        console.log(`Loaded ${basicStudents.length} basic students from offline database`);
        
        // Transform basic students to include empty class relationship
        const studentsWithEmptyClasses: StudentWithClass[] = basicStudents.map(student => ({
          ...student,
          classes: null
        }));
        
        return studentsWithEmptyClasses;
      } catch (basicError) {
        console.error('Failed to load basic students from offline DB:', basicError);
        
        if (this.isOnline) {
          return this.getStudentsFromSupabase();
        }
        
        throw new Error('No offline data available and no internet connection');
      }
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

  async updateStudent(studentId: string, studentData: Partial<Student>): Promise<void> {
    try {
      await offlineDataService.updateStudent(studentId, studentData);
      
      if (this.isOnline) {
        try {
          await this.updateStudentInSupabase(studentId, studentData);
        } catch (syncError) {
          console.error('Failed to sync student update to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        return this.updateStudentInSupabase(studentId, studentData);
      }
      throw error;
    }
  }

  async deleteStudent(studentId: string): Promise<void> {
    try {
      await offlineDataService.deleteStudent(studentId);
      
      if (this.isOnline) {
        try {
          await this.deleteStudentInSupabase(studentId);
        } catch (syncError) {
          console.error('Failed to sync student deletion to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        return this.deleteStudentInSupabase(studentId);
      }
      throw error;
    }
  }

  private async syncStudentsInBackground(): Promise<void> {
    console.log('Syncing students in background...');
  }

  private async getStudentsFromSupabase(): Promise<StudentWithClass[]> {
    console.log('Loading students from Supabase fallback...');
    // Return empty array as this is just a fallback placeholder
    return [];
  }

  private async updateStudentInSupabase(studentId: string, studentData: Partial<Student>): Promise<void> {
    console.log('Syncing student update to Supabase...');
    // TODO: Implement Supabase update logic
  }

  private async deleteStudentInSupabase(studentId: string): Promise<void> {
    console.log('Syncing student deletion to Supabase...');
    // TODO: Implement Supabase delete logic
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
    onSuccess: (studentId: string, studentData) => {
      // Log the activity
      logStudent.added(
        studentId,
        studentData.admission_number,
        `${studentData.first_name} ${studentData.last_name}`
      ).catch(err => console.error('Failed to log student creation:', err));
      
      // Invalidate all student-related queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-with-classes'] });
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

export const useUpdateStudentOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, studentData }: { studentId: string, studentData: Partial<Student> }) => {
      const service = new StudentsDataService(connectivity.isOnline);
      return await service.updateStudent(studentId, studentData);
    },
    onSuccess: (_, variables) => {
      const { studentId, studentData } = variables;
      
      // Log the activity
      if (studentData.admission_number || studentData.first_name || studentData.last_name) {
        const fullName = studentData.first_name && studentData.last_name 
          ? `${studentData.first_name} ${studentData.last_name}`
          : 'Student';
        
        logStudent.updated(
          studentId,
          studentData.admission_number || '',
          fullName,
          studentData
        ).catch(err => console.error('Failed to log student update:', err));
      }
      
      // Invalidate all student-related queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-with-classes'] });
      toast({
        title: "Success",
        description: "Student updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update student",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteStudentOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const service = new StudentsDataService(connectivity.isOnline);
      return await service.deleteStudent(studentId);
    },
    onSuccess: () => {
      // Invalidate all student-related queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-with-classes'] });
      toast({
        title: "Success",
        description: "Student deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete student",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
