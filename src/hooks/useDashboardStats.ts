import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// Local library stats interface matching Rust LibraryStats
interface LocalLibraryStats {
  total_books: number;
  total_students: number;
  total_borrowings: number;
  overdue_books: number;
  available_books: number;
  categories_count: number;
}

// Enhanced dashboard stats with additional local data
interface EnhancedDashboardStats {
  totalUsers: number;
  activeClasses: number;
  totalBorrowings: number;
  returnsThisMonth: number;
  totalBooks: number;
  activeBorrowings: number;
  overdueBorrowings: number;
  totalCollectedFines: number;
}

// Provide instant default stats to show immediately
const defaultStats: EnhancedDashboardStats = {
  totalUsers: 0,
  activeClasses: 0,
  totalBorrowings: 0,
  returnsThisMonth: 0,
  totalBooks: 0,
  activeBorrowings: 0,
  overdueBorrowings: 0,
  totalCollectedFines: 0
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<EnhancedDashboardStats> => {
      console.log('📊 Fetching dashboard stats from local database...');
      
      try {
        // Use shorter timeout for faster response
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Stats query timeout')), 1500)
        );
        
        const statsPromise = invoke('get_library_stats') as Promise<LocalLibraryStats>;
        
        const coreStats = await Promise.race([statsPromise, timeoutPromise]);
        
        // Fetch extra stats from local DB in parallel (non-blocking fallbacks on failure)
        const [classReport, allBorrowings] = await Promise.all([
          invoke('get_class_borrowing_report').catch(() => [] as any[]),
          invoke('get_borrowings').catch(() => [] as any[])
        ]);

        // Calculate returns this month from local borrowings
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const returnsThisMonth = (Array.isArray(allBorrowings) ? allBorrowings : []).filter((b: any) => {
          if (!b.returned_date) return false;
          const d = new Date(b.returned_date);
          return d.getFullYear() === year && d.getMonth() === month;
        }).length;

        // Count classes that currently have active borrowings
        const activeClasses = (Array.isArray(classReport) ? classReport : []).filter((row: any) => {
          return (row.active_borrowings || row.activeBorrowings || 0) > 0;
        }).length;

        // Map local stats to dashboard format with real data
        const enhancedStats: EnhancedDashboardStats = {
          totalUsers: coreStats.total_students || 0,
          activeClasses,
          totalBorrowings: coreStats.total_borrowings || 0,
          returnsThisMonth,
          totalBooks: coreStats.total_books || 0,
          activeBorrowings: coreStats.total_borrowings || 0,
          overdueBorrowings: coreStats.overdue_books || 0,
          totalCollectedFines: 0 // Load later if needed
        };

        console.log('📊 Local dashboard stats loaded successfully:', enhancedStats);
        return enhancedStats;
        
      } catch (error) {
        console.error('📊 Failed to load local dashboard stats:', error);
        return defaultStats;
      }
    },
    placeholderData: defaultStats,
    staleTime: 30 * 1000, // 30 seconds cache - increased for better performance
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on focus for better performance
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    refetchOnReconnect: false,
    refetchInterval: false, // Disable automatic refetching for better performance
    retry: 0, // No retries to prevent hanging
    retryDelay: 0,
    networkMode: 'offlineFirst', // Prioritize local data
  });
};
