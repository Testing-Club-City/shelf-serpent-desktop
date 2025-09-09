
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Student = Tables<'students'>;
type StudentInsert = TablesInsert<'students'>;
type StudentUpdate = TablesUpdate<'students'>;

// Optimized students hook with pagination and filtering
export const useOptimizedStudents = (
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    class_grade?: string;
    status?: string;
    academic_year?: string;
    search?: string;
  }
) => {
  return useQuery({
    queryKey: ['students-optimized', page, pageSize, filters],
    queryFn: async () => {
      console.log('Fetching optimized students...', { page, pageSize, filters });
      
      let query = supabase
        .from('students')
        .select(`
          *,
          classes (
            id,
            class_name,
            form_level,
            class_section
          )
        `, { count: 'exact' })
        .order('first_name')
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (filters?.class_grade) {
        query = query.eq('class_grade', filters.class_grade);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.academic_year) {
        query = query.eq('academic_year', filters.academic_year);
      }
      if (filters?.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,admission_number.ilike.%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching optimized students:', error);
        throw error;
      }
      
      console.log('Optimized students fetched successfully:', {
        count,
        dataLength: data?.length,
        page,
        pageSize
      });
      
      return {
        students: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
        pageSize
      };
    },
    retry: 2,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: false,
  });
};

// Get student statistics efficiently
export const useStudentStatistics = () => {
  return useQuery({
    queryKey: ['student-statistics'],
    queryFn: async () => {
      console.log('Fetching student statistics...');
      
      // Use aggregation queries for better performance
      const { data: totalCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      const { data: activeCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { data: gradeDistribution } = await supabase
        .from('students')
        .select('class_grade, status')
        .eq('status', 'active');

      const { data: yearDistribution } = await supabase
        .from('students')
        .select('academic_year, status');

      // Process grade distribution
      const gradeStats = gradeDistribution?.reduce((acc, student) => {
        acc[student.class_grade] = (acc[student.class_grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Process year distribution
      const yearStats = yearDistribution?.reduce((acc, student) => {
        acc[student.academic_year] = (acc[student.academic_year] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        total: totalCount?.length || 0,
        active: activeCount?.length || 0,
        byGrade: gradeStats,
        byYear: yearStats
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Batch operations for efficiency
export const useBatchStudentOperations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  const batchUpdateMutation = useMutation({
    mutationFn: async ({ 
      studentIds, 
      updates 
    }: { 
      studentIds: string[], 
      updates: Partial<StudentUpdate> 
    }) => {
      console.log('Performing batch update:', { studentIds, updates });
      
      const results = [];
      
      // Process in chunks of 100 for better performance
      const chunkSize = 100;
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        
        const { data, error } = await supabase
          .from('students')
          .update(updates)
          .in('id', chunk)
          .select('id, first_name, last_name');

        if (error) throw error;
        results.push(...(data || []));
      }
      
      return results;
    },
    onSuccess: (data, variables) => {
      // Invalidate all student-related queries
      queryClient.invalidateQueries({ queryKey: ['students-optimized'] });
      queryClient.invalidateQueries({ queryKey: ['student-statistics'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'batch_student_update',
        resource_type: 'student',
        resource_id: 'multiple',
        details: {
          updated_count: data.length,
          updates: variables.updates
        }
      });
      
      toast({
        title: 'Success',
        description: `${data.length} students updated successfully`,
      });
    },
    onError: (error) => {
      console.error('Batch update error:', error);
      toast({
        title: 'Error',
        description: `Failed to update students: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    batchUpdate: batchUpdateMutation
  };
};

// Get unique class grades efficiently
export const useClassGrades = () => {
  return useQuery({
    queryKey: ['class-grades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('class_grade')
        .order('class_grade');

      if (error) throw error;
      
      // Get unique class grades
      const uniqueGrades = [...new Set(data?.map(s => s.class_grade) || [])];
      return uniqueGrades.filter(Boolean).sort();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

// Get unique academic years efficiently  
export const useAcademicYears = () => {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('academic_year')
        .order('academic_year');

      if (error) throw error;
      
      // Get unique academic years
      const uniqueYears = [...new Set(data?.map(s => s.academic_year) || [])];
      return uniqueYears.filter(Boolean).sort().reverse(); // Most recent first
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};
