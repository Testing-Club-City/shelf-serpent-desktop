import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Student = Tables<'students'>;
type StudentInsert = TablesInsert<'students'>;
type StudentUpdate = TablesUpdate<'students'>;

interface UseStudentsOptions {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  classId?: string;
  fetchAll?: boolean; // New option to fetch all students at once
}

// Function to fetch all students with pagination
async function fetchAllStudents(searchTerm = '', classId?: string) {
  const limit = 1000; // Max records per request
  let offset = 0;
  let allStudents: any[] = [];
  let hasMore = true;
  let totalCount = 0;

  while (hasMore) {
    // Start building the query
    let query = supabase
      .from('students')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);

    // Add search filter if searchTerm is provided
    if (searchTerm) {
      query = query.or(
        `first_name.ilike.%${searchTerm}%,` +
        `last_name.ilike.%${searchTerm}%,` +
        `admission_number.ilike.%${searchTerm}%`
      );
    }

    // Add class filter if classId is provided
    if (classId) {
      query = query.eq('class_id', classId);
    }

    // Execute the query
    const { data, error, count } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
      throw error;
    }

    if (data) {
      allStudents = [...allStudents, ...data];
    }
    
    totalCount = count || 0;
    
    // If we got fewer records than the limit, we've reached the end
    if (!data || data.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return { data: allStudents, count: totalCount };
}

export function useStudents(options: UseStudentsOptions = {}) {
  const { toast } = useToast();
  const { page = 1, pageSize = 100, searchTerm = '', classId, fetchAll = false } = options;

  return useQuery({
    queryKey: ['students', page, pageSize, searchTerm, classId, fetchAll],
    queryFn: async () => {
      if (fetchAll) {
        // Fetch all students with pagination
        const { data: allStudents, count } = await fetchAllStudents(searchTerm, classId);
        
        return {
          students: allStudents,
          totalCount: count,
          currentPage: 1,
          totalPages: 1,
        };
      }
      
      // For paginated results
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Start building the query
      let query = supabase
        .from('students')
        .select('*', { count: 'exact' })
        .range(from, to);

      // Add search filter if searchTerm is provided
      if (searchTerm) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,` +
          `last_name.ilike.%${searchTerm}%,` +
          `admission_number.ilike.%${searchTerm}%`
        );
      }

      // Add class filter if classId is provided
      if (classId) {
        query = query.eq('class_id', classId);
      }

      // Execute the query
      const { data, error, count } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      return {
        students: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (student: StudentInsert) => {
      console.log('Creating student:', student);
      
      const studentData = {
        admission_number: student.admission_number,
        first_name: student.first_name,
        last_name: student.last_name,
        class_grade: student.class_grade,
        status: student.status || 'active',
        class_id: student.class_id,
        academic_year: student.academic_year || '2024/2025',
        is_repeating: student.is_repeating || false,
      };

      const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating student:', error);
        throw error;
      }
      
      console.log('Student created successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'student_created',
        resource_type: 'student',
        resource_id: data.id,
        details: {
          name: `${variables.first_name} ${variables.last_name}`,
          admission_number: variables.admission_number,
          class_grade: variables.class_grade
        }
      });
      
      toast({
        title: 'Success',
        description: 'Student created successfully',
      });
    },
    onError: (error) => {
      console.error('Create student mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to create student: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateStudent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async ({ id, ...updates }: StudentUpdate & { id: string }) => {
      console.log('Updating student:', id, updates);
      
      const studentData: Partial<StudentUpdate> = {};
      
      if (updates.admission_number !== undefined) {
        studentData.admission_number = updates.admission_number;
      }
      if (updates.first_name !== undefined) {
        studentData.first_name = updates.first_name;
      }
      if (updates.last_name !== undefined) {
        studentData.last_name = updates.last_name;
      }
      if (updates.class_grade !== undefined) {
        studentData.class_grade = updates.class_grade;
      }
      if (updates.status !== undefined) {
        studentData.status = updates.status;
      }
      if (updates.class_id !== undefined) {
        studentData.class_id = updates.class_id;
      }
      if (updates.is_repeating !== undefined) {
        studentData.is_repeating = updates.is_repeating;
      }
      if (updates.academic_year !== undefined) {
        studentData.academic_year = updates.academic_year;
      }

      const { data, error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating student:', error);
        throw error;
      }
      
      console.log('Student updated successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'student_updated',
        resource_type: 'student',
        resource_id: data.id,
        details: {
          name: `${data.first_name} ${data.last_name}`,
          changes: variables
        }
      });
      
      toast({
        title: 'Success',
        description: 'Student updated successfully',
      });
    },
    onError: (error) => {
      console.error('Update student mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to update student: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteStudent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get student details for logging
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name, admission_number')
        .eq('id', id)
        .single();

      // Check if student has active borrowings before deletion
      const { data: activeBorrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select('id, tracking_code, books(title)')
        .eq('student_id', id)
        .eq('status', 'active');
      
      if (borrowingsError) {
        console.error('Error checking student borrowings:', borrowingsError);
      }
      
      // If student has active borrowings, throw a specific error
      if (activeBorrowings && activeBorrowings.length > 0) {
        const bookTitles = activeBorrowings.map(b => b.books?.title || `Book #${b.tracking_code}`).join(', ');
        throw new Error(
          `Cannot delete student with active borrowings. ` +
          `${student?.first_name} ${student?.last_name} has ${activeBorrowings.length} ` +
          `active ${activeBorrowings.length === 1 ? 'borrowing' : 'borrowings'}: ${bookTitles}. ` +
          `Please ensure all books are returned before deleting this student record.`
        );
      }

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting student:', error);
        
        // Handle foreign key constraint violation errors
        if (error.message.includes('violates foreign key constraint') && 
            error.message.includes('borrowings_student_id_fkey')) {
          throw new Error(
            `Cannot delete student record. ${student?.first_name} ${student?.last_name} ` +
            `has borrowing history in the system. Please archive the student instead of deleting.`
          );
        }
        
        throw error;
      }

      return { id, student };
    },
    onSuccess: ({ id, student }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'student_deleted',
        resource_type: 'student',
        resource_id: id,
        details: {
          name: `${student?.first_name} ${student?.last_name}`,
          admission_number: student?.admission_number
        }
      });
      
      toast({
        title: 'Success',
        description: 'Student deleted successfully',
      });
    },
    onError: (error: any) => {
      console.error('Delete student mutation error:', error);
      
      // Show a more user-friendly error message
      toast({
        title: 'Student Deletion Failed',
        description: error.message || 'Failed to delete student record',
        variant: 'destructive',
      });
    },
  });
};
