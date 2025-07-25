import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      console.log('Fetching optimized dashboard statistics...');
      
      // Use efficient count queries with head: true for better performance
      const [
        { count: totalUsers },
        { data: allClasses },
        { data: allStudents },
        { count: todayActions },
        { count: totalBooks },
        { count: activeBorrowings },
        { count: overdueBorrowings },
        { data: collectedFines }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),
        
        // Get all classes to filter those with students
        supabase
          .from('classes')
          .select('*'),
        
        // Get all students to check class assignments
        supabase
          .from('students')
          .select('class_id'),
        
        supabase
          .from('system_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]),
        supabase
          .from('books')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('borrowings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active' as const),
        supabase
          .from('borrowings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active' as const)
          .lt('due_date', new Date().toISOString().split('T')[0]),
        // Get collected fines (from both fines table and borrowings table)
        supabase
          .from('fines')
          .select('amount')
          .eq('status', 'paid')
      ]);

      // Get borrowing-based fines that have been paid
      const { data: paidBorrowingFines } = await supabase
        .from('borrowings')
        .select('fine_amount')
        .eq('fine_paid', true)
        .not('fine_amount', 'is', null);

      // Calculate active classes using same logic as ClassManagement
      // Only count classes that have students assigned
      const activeClasses = allClasses?.filter(cls => {
        const studentsInClass = allStudents?.filter(student => 
          student.class_id === cls.id
        ).length || 0;
        return studentsInClass > 0;
      }).length || 0;

      // Calculate total collected fines
      const finesTableTotal = collectedFines?.reduce((sum, fine) => sum + (fine.amount || 0), 0) || 0;
      const borrowingsTableTotal = paidBorrowingFines?.reduce((sum, borrowing) => sum + (borrowing.fine_amount || 0), 0) || 0;
      const totalCollectedFines = finesTableTotal + borrowingsTableTotal;

      console.log('Dashboard stats fetched successfully:', {
        totalUsers,
        activeClasses,
        todayActions,
        totalBooks,
        activeBorrowings,
        overdueBorrowings,
        totalCollectedFines
      });

      return {
        totalUsers: totalUsers || 0,
        activeClasses,
        todayActions: todayActions || 0,
        totalBooks: totalBooks || 0,
        activeBorrowings: activeBorrowings || 0,
        overdueBorrowings: overdueBorrowings || 0,
        totalCollectedFines
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 10, // Refetch every 10 minutes
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });
};
