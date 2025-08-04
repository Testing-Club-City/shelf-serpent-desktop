import { invoke } from '@tauri-apps/api/core';

// Types matching the Rust models
export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  genre?: string;
  publisher?: string;
  publication_year?: number;
  total_copies: number;
  available_copies: number;
  shelf_location?: string;
  cover_image_url?: string;
  description?: string;
  status: 'available' | 'unavailable' | 'damaged' | 'lost';
  category_id?: string;
  created_at: string;
  updated_at: string;
  condition?: 'excellent' | 'good' | 'fair' | 'damaged' | 'lost' | 'stolen';
  book_code?: string;
  acquisition_year?: number;
  legacy_book_id?: number;
  legacy_isbn?: string;
}

export interface BookWithDetails {
  book: Book;
  category?: Category;
  copies: BookCopy[];
  active_borrowings: Borrowing[];
}

export interface BookCopy {
  id: string;
  book_id?: string;
  copy_number: number;
  book_code: string;
  condition: 'good' | 'fair' | 'poor' | 'damaged' | 'lost';
  status: 'available' | 'borrowed' | 'maintenance' | 'lost' | 'stolen';
  created_at: string;
  updated_at: string;
  tracking_code?: string;
  notes?: string;
  legacy_book_id?: number;
}

export interface Class {
  id: string;
  class_name: string;
  form_level: number;
  class_section?: string;
  max_books_allowed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  academic_level_type: 'form' | 'grade';
}

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  class_grade: string;
  address?: string;
  date_of_birth?: string;
  enrollment_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  class_id?: string;
  academic_year: string;
  is_repeating: boolean;
  legacy_student_id?: number;
}

export interface StudentWithClass {
  student: Student;
  class?: Class;
  active_borrowings: Borrowing[];
  total_fines: number;
}

export interface Staff {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  legacy_staff_id?: number;
}

export interface Borrowing {
  id: string;
  student_id?: string;
  book_id?: string;
  borrowed_date: string;
  due_date: string;
  returned_date?: string;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  fine_amount: number;
  notes?: string;
  issued_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  fine_paid: boolean;
  book_copy_id?: string;
  condition_at_issue: string;
  condition_at_return?: string;
  is_lost: boolean;
  tracking_code?: string;
  return_notes?: string;
  copy_condition?: string;
  group_borrowing_id?: string;
  borrower_type: 'student' | 'staff';
  staff_id?: string;
}

export interface BorrowingWithDetails {
  borrowing: Borrowing;
  book?: Book;
  student?: Student;
  staff?: Staff;
  book_copy?: BookCopy;
}

export interface Fine {
  id: string;
  student_id?: string;
  borrowing_id?: string;
  fine_type: string;
  amount: number;
  description?: string;
  status: 'unpaid' | 'paid' | 'cleared' | 'collected' | 'partial' | 'waived';
  created_at: string;
  updated_at: string;
  created_by?: string;
  borrower_type: 'student' | 'staff';
  staff_id?: string;
}

export interface LibraryStats {
  total_books: number;
  total_students: number;
  active_borrowings: number;
  overdue_borrowings: number;
  total_fines: number;
}

export interface SyncStatus {
  is_online: boolean;
  is_syncing: boolean;
  pending_operations: number;
  last_sync?: string;
}

// API Functions

// Book Operations
export async function createBook(bookData: Partial<Book>): Promise<Book> {
  return await invoke('create_book', { bookData });
}

export async function getBooks(limit?: number, offset?: number): Promise<BookWithDetails[]> {
  return await invoke('get_books', { limit, offset });
}

export async function searchBooks(query: string, limit?: number): Promise<BookWithDetails[]> {
  return await invoke('search_books', { query, limit });
}

// Student Operations
export async function createStudent(studentData: Partial<Student>): Promise<Student> {
  return await invoke('create_student', { studentData });
}

export async function getStudents(limit?: number, offset?: number): Promise<StudentWithClass[]> {
  return await invoke('get_students', { limit, offset });
}

export async function searchStudents(query: string, limit?: number): Promise<StudentWithClass[]> {
  return await invoke('search_students', { query, limit });
}

// Category Operations
export async function createCategory(name: string, description?: string): Promise<Category> {
  return await invoke('create_category', { name, description });
}

export async function getCategories(): Promise<Category[]> {
  return await invoke('get_categories');
}

// Borrowing Operations
export async function createBorrowing(borrowingData: Partial<Borrowing>): Promise<Borrowing> {
  return await invoke('create_borrowing', { borrowingData });
}

export async function getOverdueBorrowings(): Promise<BorrowingWithDetails[]> {
  return await invoke('get_overdue_borrowings');
}

// Analytics
export async function getLibraryStats(): Promise<LibraryStats> {
  return await invoke('get_library_stats');
}

// Sync Operations
export async function setupSync(
  supabaseUrl: string,
  supabaseAnonKey: string,
  serviceRoleKey?: string
): Promise<void> {
  return await invoke('setup_sync_config', {
    config: {
      supabaseUrl,
      supabaseAnonKey,
      serviceRoleKey,
    }
  });
}

export async function startSync(): Promise<void> {
  return await invoke('trigger_sync');
}

export async function forceSync(): Promise<void> {
  return await invoke('trigger_sync');
}

export async function initialDataPull(): Promise<void> {
  return await invoke('initial_data_pull');
}

export async function checkLocalDataCount(): Promise<any> {
  return await invoke('check_local_data_count');
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return await invoke('get_sync_status');
}

export async function isOnline(): Promise<boolean> {
  return await invoke('check_connectivity');
}

// Utility Functions
export async function generateUuid(): Promise<string> {
  return await invoke('generate_uuid');
}

export async function validateIsbn(isbn: string): Promise<boolean> {
  return await invoke('validate_isbn', { isbn });
}

export async function calculateDueDate(borrowedDate: string, loanPeriodDays: number): Promise<string> {
  return await invoke('calculate_due_date', { borrowedDate, loanPeriodDays });
}

// Import/Export
export async function exportData(tableName: string, format: string): Promise<string> {
  return await invoke('export_data', { tableName, format });
}

export async function importData(tableName: string, data: any): Promise<string> {
  return await invoke('import_data', { tableName, data });
}

// Database Maintenance
export async function optimizeDatabase(): Promise<string> {
  return await invoke('optimize_database');
}

export async function backupDatabase(backupPath: string): Promise<string> {
  return await invoke('backup_database', { backupPath });
}

export async function getDatabaseInfo(): Promise<any> {
  return await invoke('get_database_info');
}

// React Hooks for the new API
import { useState, useEffect, useCallback } from 'react';

export function useBooks(limit?: number, offset?: number) {
  const [books, setBooks] = useState<BookWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBooks(limit, offset);
      setBooks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return { books, loading, error, refetch: fetchBooks };
}

export function useStudents(limit?: number, offset?: number) {
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStudents(limit, offset);
      setStudents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, loading, error, refetch: fetchStudents };
}

export function useLibraryStats() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLibraryStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSyncStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll sync status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

// Search hooks
export function useBookSearch() {
  const [results, setResults] = useState<BookWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit?: number) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const data = await searchBooks(query, limit);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search books');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

export function useStudentSearch() {
  const [results, setResults] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit?: number) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const data = await searchStudents(query, limit);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search students');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}
