import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

interface OptimizedBook {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publication_year?: number;
  total_copies: number;
  available_copies: number;
  shelf_location?: string;
  description?: string;
  book_code?: string;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
  };
  status: string;
}

interface PaginatedBooksResponse {
  data: OptimizedBook[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface DashboardStats {
  total_books: number;
  total_students: number;
  active_borrowings: number;
  overdue_books: number;
  available_books: number;
  total_categories: number;
}

// Fast book loading hook
export const useBooksOptimized = () => {
  return useQuery({
    queryKey: ['books', 'optimized'],
    queryFn: async (): Promise<OptimizedBook[]> => {
      return await invoke('get_books_fast');
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Paginated books hook
export const useBooksPaginated = (page: number = 1, pageSize: number = 20) => {
  return useQuery({
    queryKey: ['books', 'paginated', page, pageSize],
    queryFn: async (): Promise<PaginatedBooksResponse> => {
      return await invoke('get_books_paginated', { page, pageSize });
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
    placeholderData: (previousData) => previousData,
  });
};

// Fast book search hook
export const useBookSearch = (query: string) => {
  return useQuery({
    queryKey: ['books', 'search', query],
    queryFn: async (): Promise<OptimizedBook[]> => {
      if (!query.trim()) return [];
      return await invoke('search_books_fast', { query });
    },
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Dashboard stats hook
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      return await invoke('get_dashboard_stats');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });
};

// Initialize performance indexes
export const initializePerformanceIndexes = async (): Promise<string> => {
  return await invoke('initialize_performance_indexes');
};