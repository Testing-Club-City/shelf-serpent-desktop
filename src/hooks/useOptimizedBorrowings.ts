
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Optimized borrowings hook with pagination and efficient queries
export const useOptimizedBorrowings = (
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    status?: 'active' | 'returned' | 'overdue' | 'lost';
    student_id?: string;
    overdue_only?: boolean;
    academic_year?: string;
  }
) => {
  return useQuery({
    queryKey: ['borrowings-optimized', page, pageSize, filters],
    queryFn: async () => {
      console.log('Fetching optimized borrowings...', { page, pageSize, filters });
      
      let query = supabase
        .from('borrowings')
        .select(`
          id,
          borrowed_date,
          due_date,
          returned_date,
          status,
          is_lost,
          tracking_code,
          students!inner (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade,
            academic_year
          ),
          books!inner (
            id,
            title,
            author,
            book_code
          ),
          book_copies (
            id,
            tracking_code,
            condition,
            status
          )
        `, { count: 'exact' })
        .order('borrowed_date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.student_id) {
        query = query.eq('student_id', filters.student_id);
      }
      if (filters?.overdue_only) {
        query = query
          .eq('status', 'active' as const)
          .lt('due_date', new Date().toISOString().split('T')[0]);
      }
      if (filters?.academic_year) {
        query = query.eq('students.academic_year', filters.academic_year);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching optimized borrowings:', error);
        throw error;
      }
      
      console.log('Optimized borrowings fetched successfully:', {
        count,
        dataLength: data?.length,
        page,
        pageSize
      });
      
      return {
        borrowings: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
        pageSize
      };
    },
    retry: 2,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Get borrowing statistics efficiently
export const useBorrowingStatistics = () => {
  return useQuery({
    queryKey: ['borrowing-statistics'],
    queryFn: async () => {
      console.log('Fetching borrowing statistics...');
      
      // Use efficient aggregation queries
      const [
        { count: totalBorrowings },
        { count: activeBorrowings },
        { count: overdueBorrowings },
        { count: returnedBorrowings },
        { count: lostBooks }
      ] = await Promise.all([
        supabase.from('borrowings').select('*', { count: 'exact', head: true }),
        supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'active' as const),
        supabase.from('borrowings').select('*', { count: 'exact', head: true })
          .eq('status', 'active' as const)
          .lt('due_date', new Date().toISOString().split('T')[0]),
        supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'returned' as const),
        supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('is_lost', true)
      ]);

      return {
        total: totalBorrowings || 0,
        active: activeBorrowings || 0,
        overdue: overdueBorrowings || 0,
        returned: returnedBorrowings || 0,
        lost: lostBooks || 0
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Efficient overdue borrowings query
export const useOverdueBorrowings = () => {
  return useQuery({
    queryKey: ['overdue-borrowings'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          id,
          due_date,
          borrowed_date,
          students!inner (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade
          ),
          books!inner (
            id,
            title,
            author
          )
        `)
        .eq('status', 'active' as const)
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(100); // Limit for performance

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
