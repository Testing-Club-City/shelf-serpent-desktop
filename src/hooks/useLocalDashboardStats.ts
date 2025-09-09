import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// Local dashboard stats interface matching Rust LibraryStats
interface LocalLibraryStats {
  total_books: number;
  total_students: number;
  total_borrowings: number;
  overdue_books: number;
  available_books: number;
  categories_count: number;
}

// Enhanced dashboard stats with additional local data
interface EnhancedDashboardStats extends LocalLibraryStats {
  total_staff: number;
  total_fines: number;
  total_group_borrowings: number;
  recent_activity_count: number;
}

// Provide instant default stats for immediate display
const defaultStats: EnhancedDashboardStats = {
  total_books: 0,
  total_students: 0,
  total_borrowings: 0,
  overdue_books: 0,
  available_books: 0,
  categories_count: 0,
  total_staff: 0,
  total_fines: 0,
  total_group_borrowings: 0,
  recent_activity_count: 0
};

export const useLocalDashboardStats = () => {
  return useQuery({
    queryKey: ['local-dashboard-stats'],
    queryFn: async (): Promise<EnhancedDashboardStats> => {
      console.log('📊 Fetching dashboard stats from local database...');
      
      try {
        // Get core library stats from optimized Tauri command
        const coreStats: LocalLibraryStats = await invoke('get_library_stats');
        
        // Get additional stats in parallel for enhanced dashboard
        const [staffData, finesData, groupBorrowingsData] = await Promise.all([
          invoke('get_staff').catch(() => []),
          invoke('get_fines').catch(() => []),
          invoke('get_group_borrowings').catch(() => [])
        ]);

        // Calculate enhanced stats
        const enhancedStats: EnhancedDashboardStats = {
          ...coreStats,
          total_staff: Array.isArray(staffData) ? staffData.length : 0,
          total_fines: Array.isArray(finesData) ? finesData.length : 0,
          total_group_borrowings: Array.isArray(groupBorrowingsData) ? groupBorrowingsData.length : 0,
          recent_activity_count: coreStats.total_borrowings // Simplified for now
        };

        console.log('📊 Local dashboard stats loaded:', enhancedStats);
        return enhancedStats;
        
      } catch (error) {
        console.error('📊 Failed to load local dashboard stats:', error);
        // Return defaults on error - still better than network dependency
        return defaultStats;
      }
    },
    // Optimized for local database performance
    placeholderData: defaultStats, // Show defaults immediately
    staleTime: 5 * 60 * 1000, // 5 minutes - local data changes less frequently
    refetchOnWindowFocus: true, // Refresh when user returns to app
    refetchOnMount: true, // Always get fresh data on mount
    refetchOnReconnect: false, // No network dependency
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    retry: 1, // Minimal retries for local database
    retryDelay: 100 // Fast retry for local operations
  });
};

// Hook for real-time dashboard updates
export const useRealtimeDashboardStats = () => {
  const query = useLocalDashboardStats();
  
  // Force refresh when certain actions occur
  const refreshStats = () => {
    query.refetch();
  };
  
  return {
    ...query,
    refreshStats
  };
};

// Export types for use in components
export type { LocalLibraryStats, EnhancedDashboardStats };
