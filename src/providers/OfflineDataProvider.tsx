import React, { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBooksOffline, useCategoriesOffline, useConnectivity } from '@/hooks/offline';
import { Book, Category } from '@/types/offline';

// Create a custom QueryClient for offline-first operations
const offlineQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // More aggressive retry for offline scenarios
        if (error?.message?.includes('offline') || error?.message?.includes('network')) {
          return failureCount < 3;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

interface OfflineDataContextType {
  // Books
  books: Book[];
  booksLoading: boolean;
  booksError: any;
  refetchBooks: () => void;
  
  // Categories
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: any;
  refetchCategories: () => void;
  
  // Connectivity
  isOnline: boolean;
  isOffline: boolean;
  
  // Utility functions
  isDataAvailable: boolean;
  lastSyncTime: Date | null;
}

const OfflineDataContext = createContext<OfflineDataContextType | undefined>(undefined);

interface OfflineDataProviderProps {
  children: ReactNode;
}

export const OfflineDataProvider: React.FC<OfflineDataProviderProps> = ({ children }) => {
  const connectivity = useConnectivity();
  
  // Books data
  const booksQuery = useBooksOffline();
  const books = (booksQuery.data as Book[]) || [];
  const booksLoading = booksQuery.isLoading;
  const booksError = booksQuery.error;
  const refetchBooks = booksQuery.refetch;

  // Categories data
  const categoriesQuery = useCategoriesOffline();
  const categories = (categoriesQuery.data as Category[]) || [];
  const categoriesLoading = categoriesQuery.isLoading;
  const categoriesError = categoriesQuery.error;
  const refetchCategories = categoriesQuery.refetch;

  // Check if we have any data available offline
  const isDataAvailable = (Array.isArray(books) && books.length > 0) || 
                         (Array.isArray(categories) && categories.length > 0);
  
  // For now, we'll use a simple timestamp - in production, this would come from sync metadata
  const lastSyncTime = new Date();

  const contextValue: OfflineDataContextType = {
    // Books
    books: books || [],
    booksLoading,
    booksError,
    refetchBooks,
    
    // Categories
    categories: categories || [],
    categoriesLoading,
    categoriesError,
    refetchCategories,
    
    // Connectivity
    isOnline: connectivity.isOnline,
    isOffline: !connectivity.isOnline,
    
    // Utility
    isDataAvailable,
    lastSyncTime,
  };

  return (
    <QueryClientProvider client={offlineQueryClient}>
      <OfflineDataContext.Provider value={contextValue}>
        {children}
      </OfflineDataContext.Provider>
    </QueryClientProvider>
  );
};

export const useOfflineData = () => {
  const context = useContext(OfflineDataContext);
  if (context === undefined) {
    throw new Error('useOfflineData must be used within an OfflineDataProvider');
  }
  return context;
};

// Hook for checking offline data readiness
export const useOfflineDataStatus = () => {
  const { isDataAvailable, isOnline, isOffline } = useOfflineData();
  
  return {
    isReady: isDataAvailable,
    isOnline,
    isOffline,
    canOperateOffline: isDataAvailable,
    needsSync: !isDataAvailable && isOnline,
  };
};
