import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';

export interface SyncProgress {
  issyncing: boolean;
  currentTask: string;
  progress: number;
  total: number;
  lastSync: string | null;
  errors: string[];
}

export interface SyncStats {
  books: number;
  students: number;
  categories: number;
  borrowings: number;
  staff?: number;
  classes?: number;
  bookCopies: number;
  fines?: number;
  fineSettings?: number;
  groupBorrowings?: number;
  theftReports?: number;
}

export const useProfessionalSync = () => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    issyncing: false,
    currentTask: '',
    progress: 0,
    total: 0,
    lastSync: null,
    errors: []
  });

  const { toast } = useToast();

  const syncBooks = useCallback(async (limit: number = 100): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing books from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<any>('sync_books_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Books sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Books Synchronized",
        description: `Successfully synced books from Supabase`,
        variant: "default",
      });

      return { books: result.recordsSync || 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Books sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync books: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncCategories = useCallback(async (): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing categories from Supabase...',
      progress: 0,
      errors: []
    }));

    try {
      const result = await invoke<any>('sync_categories_only');
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Categories sync completed',
        progress: 100,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Categories Synchronized",
        description: `Successfully synced categories from Supabase`,
        variant: "default",
      });

      return { categories: result.recordsSync || 0, books: 0, students: 0, borrowings: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Categories sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync categories: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncStudents = useCallback(async (limit: number = 100): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing students from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<any>('sync_students_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Students sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Students Synchronized",
        description: `Successfully synced students from Supabase`,
        variant: "default",
      });

      return { students: result.recordsSync || 0, books: 0, categories: 0, borrowings: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Students sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync students: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncBorrowings = useCallback(async (limit: number = 1000): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing borrowings from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_borrowings_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Borrowings sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Borrowings Synchronized",
        description: `Successfully synced ${result} borrowings from Supabase`,
        variant: "default",
      });

      return { borrowings: result || 0, books: 0, students: 0, categories: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Borrowings sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync borrowings: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncStaff = useCallback(async (limit: number = 100): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing staff from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_staff_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Staff sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Staff Synchronized",
        description: `Successfully synced ${result} staff members from Supabase`,
        variant: "default",
      });

      return { staff: result || 0, books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Staff sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync staff: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncClasses = useCallback(async (): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Syncing classes from Supabase...',
      progress: 0,
      total: 100,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_classes_only');
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Classes sync completed',
        progress: 100,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Classes Synchronized",
        description: `Successfully synced ${result} classes from Supabase`,
        variant: "default",
      });

      return { classes: result || 0, books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Classes sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync classes: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const pullAllDatabase = useCallback(async (): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '🚀 Starting complete database pull...',
      progress: 0,
      total: 100,
      errors: []
    }));

    try {
      const result = await invoke<string>('pull_all_database');
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: '🎉 Complete database pull finished!',
        progress: 100,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "🚀 Complete Database Pulled!",
        description: result,
        variant: "default",
      });

      // Get fresh stats after full pull
      try {
        const freshStats = await invoke<SyncStats>('get_local_data_stats');
        return freshStats;
      } catch (statsError) {
        console.error('Failed to get fresh stats:', statsError);
        return { books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0 };
      }
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Database pull failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to pull complete database: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncBookCopies = useCallback(async (limit: number = 100000): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '📚 Syncing book copies from Supabase... (Large dataset: ~90K records)',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_book_copies_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Book copies sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "📚 Book Copies Synchronized",
        description: `Successfully synced ${result.toLocaleString()} book copies from Supabase`,
        variant: "default",
      });

      return { bookCopies: result || 0, books: 0, students: 0, categories: 0, borrowings: 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Book copies sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync book copies: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncFines = useCallback(async (limit: number = 10000): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '💰 Syncing fines from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_fines_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Fines sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "💰 Fines Synchronized",
        description: `Successfully synced ${result.toLocaleString()} fines from Supabase`,
        variant: "default",
      });

      return { books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0, fines: result || 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Fines sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync fines: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncFineSettings = useCallback(async (): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '⚙️ Syncing fine settings from Supabase...',
      progress: 0,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_fine_settings_only');
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Fine settings sync completed',
        progress: 100,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "⚙️ Fine Settings Synchronized",
        description: `Successfully synced ${result.toLocaleString()} fine settings from Supabase`,
        variant: "default",
      });

      return { books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0, fineSettings: result || 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Fine settings sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync fine settings: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncGroupBorrowings = useCallback(async (limit: number = 10000): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '👥 Syncing group borrowings from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_group_borrowings_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Group borrowings sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "👥 Group Borrowings Synchronized",
        description: `Successfully synced ${result.toLocaleString()} group borrowings from Supabase`,
        variant: "default",
      });

      return { books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0, groupBorrowings: result || 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Group borrowings sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync group borrowings: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncTheftReports = useCallback(async (limit: number = 10000): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: '🚨 Syncing theft reports from Supabase...',
      progress: 0,
      total: limit,
      errors: []
    }));

    try {
      const result = await invoke<number>('sync_theft_reports_only', { limit });
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Theft reports sync completed',
        progress: limit,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "🚨 Theft Reports Synchronized",
        description: `Successfully synced ${result.toLocaleString()} theft reports from Supabase`,
        variant: "default",
      });

      return { books: 0, students: 0, categories: 0, borrowings: 0, bookCopies: 0, theftReports: result || 0 };
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Theft reports sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Sync Failed",
        description: `Failed to sync theft reports: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const syncAll = useCallback(async (): Promise<SyncStats> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Starting full synchronization...',
      progress: 0,
      total: 4,
      errors: []
    }));

    try {
      let finalStats: SyncStats = {
        books: 0,
        students: 0,
        categories: 0,
        borrowings: 0,
        bookCopies: 0
      };

      // Sync categories first
      setSyncProgress(prev => ({ ...prev, currentTask: 'Syncing categories...', progress: 1 }));
      const categoriesResult = await syncCategories();
      finalStats.categories = categoriesResult.categories;

      // Sync books
      setSyncProgress(prev => ({ ...prev, currentTask: 'Syncing books...', progress: 2 }));
      const booksResult = await syncBooks(500); // Sync more books in full sync
      finalStats.books = booksResult.books;

      // Sync students
      setSyncProgress(prev => ({ ...prev, currentTask: 'Syncing students...', progress: 3 }));
      const studentsResult = await syncStudents(500);
      finalStats.students = studentsResult.students;

      // Get final stats
      setSyncProgress(prev => ({ ...prev, currentTask: 'Getting final statistics...', progress: 4 }));
      const stats = await invoke<SyncStats>('get_local_data_stats');

      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Full synchronization completed',
        progress: 4,
        lastSync: new Date().toISOString()
      }));

      toast({
        title: "Full Sync Completed",
        description: `Synchronized ${stats.books} books, ${stats.students} students, ${stats.categories} categories`,
        variant: "default",
      });

      return stats;
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Full sync failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Full Sync Failed",
        description: `Failed to complete full sync: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [syncBooks, syncCategories, syncStudents, toast]);

  const clearDatabase = useCallback(async (): Promise<void> => {
    setSyncProgress(prev => ({
      ...prev,
      issyncing: true,
      currentTask: 'Clearing local database...',
      progress: 0,
      errors: []
    }));

    try {
      await invoke('clear_local_database');
      
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Database cleared',
        progress: 100,
        lastSync: null
      }));

      toast({
        title: "Database Cleared",
        description: "Local database has been cleared successfully",
        variant: "default",
      });
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentTask: 'Clear database failed',
        errors: [...prev.errors, error.toString()]
      }));

      toast({
        title: "Clear Failed",
        description: `Failed to clear database: ${error}`,
        variant: "destructive",
      });

      throw error;
    }
  }, [toast]);

  const getLocalStats = useCallback(async (): Promise<SyncStats> => {
    try {
      const stats = await invoke<SyncStats>('get_local_data_stats');
      return stats;
    } catch (error: any) {
      console.error('Failed to get local stats:', error);
      return { 
        books: 0, 
        students: 0, 
        categories: 0, 
        borrowings: 0, 
        bookCopies: 0,
        fines: 0,
        fineSettings: 0,
        groupBorrowings: 0,
        theftReports: 0
      };
    }
  }, []);

  return {
    syncProgress,
    syncBooks,
    syncCategories,
    syncStudents,
    syncBorrowings,
    syncStaff,
    syncClasses,
    syncBookCopies,
    syncFines,
    syncFineSettings,
    syncGroupBorrowings,
    syncTheftReports,
    syncAll,
    pullAllDatabase,
    clearDatabase,
    getLocalStats,
    issyncing: syncProgress.issyncing
  };
};
