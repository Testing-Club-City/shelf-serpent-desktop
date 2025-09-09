
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      console.log('Fetching comprehensive admin statistics...');
      
      // Get total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active users (not suspended)
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('suspended', false);

      // Get librarians count
      const { count: librarians } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'librarian');

      // Get admins count
      const { count: admins } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      // Get total books count
      const { count: totalBooks } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true });

      // Get available books count
      const { count: availableBooks } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .gt('available_copies', 0);

      // Get total students count
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // Get active students count
      const { count: activeStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total classes count
      const { count: totalClasses } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true });

      // Get active classes count
      const { count: activeClasses } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get active borrowings count
      const { count: activeBorrowings } = await supabase
        .from('borrowings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get overdue borrowings count
      const today = new Date().toISOString().split('T')[0];
      const { count: overdueBorrowings } = await supabase
        .from('borrowings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .lt('due_date', today);

      // Get unpaid fines count
      const { count: unpaidFines } = await supabase
        .from('fines')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unpaid');

      // Get total fine amount
      const { data: fineData } = await supabase
        .from('fines')
        .select('amount')
        .eq('status', 'unpaid');

      const totalFineAmount = fineData?.reduce((sum, fine) => sum + Number(fine.amount), 0) || 0;

      // Get recent system activity (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentActivity } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo);

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        librarians: librarians || 0,
        admins: admins || 0,
        totalBooks: totalBooks || 0,
        availableBooks: availableBooks || 0,
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        totalClasses: totalClasses || 0,
        activeClasses: activeClasses || 0,
        activeBorrowings: activeBorrowings || 0,
        overdueBorrowings: overdueBorrowings || 0,
        unpaidFines: unpaidFines || 0,
        totalFineAmount,
        recentActivity: recentActivity || 0,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
