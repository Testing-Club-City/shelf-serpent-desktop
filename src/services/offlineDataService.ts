// @ts-ignore - Tauri types will be available at runtime
import { invoke } from '@tauri-apps/api/core';
import type { 
  Book, 
  BookWithDetails, 
  Category, 
  Class,
  Student, 
  Staff,
  Borrowing,
  BorrowingWithDetails,
  Fine,
  FineWithDetails
} from '@/types/offline';

// Offline-first data service using Tauri commands
export class OfflineDataService {
  // Books
  static async getBooks(): Promise<BookWithDetails[]> {
    try {
      return await invoke('get_books');
    } catch (error) {
      console.error('Failed to get books from offline database:', error);
      throw error;
    }
  }

  static async searchBooks(query: string): Promise<Book[]> {
    try {
      return await invoke('search_books', { query });
    } catch (error) {
      console.error('Failed to search books:', error);
      throw error;
    }
  }

  static async createBook(bookData: any): Promise<string> {
    try {
      return await invoke('create_book', { bookData });
    } catch (error) {
      console.error('Failed to create book:', error);
      throw error;
    }
  }

  static async updateBook(bookId: string, bookData: any): Promise<void> {
    try {
      await invoke('update_book', { bookId, bookData });
    } catch (error) {
      console.error('Failed to update book:', error);
      throw error;
    }
  }

  static async deleteBook(bookId: string): Promise<void> {
    try {
      await invoke('delete_book', { bookId });
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw error;
    }
  }

  // Categories
  static async getCategories(): Promise<Category[]> {
    try {
      return await invoke('get_categories');
    } catch (error) {
      console.error('Failed to get categories:', error);
      throw error;
    }
  }

  static async createCategory(categoryData: any): Promise<string> {
    try {
      return await invoke('create_category', { categoryData });
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  static async updateCategory(categoryId: string, categoryData: any): Promise<void> {
    try {
      await invoke('update_category', { categoryId, categoryData });
    } catch (error) {
      console.error('Failed to update category:', error);
      throw error;
    }
  }

  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      await invoke('delete_category', { categoryId });
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  // Classes
  static async getClasses(): Promise<Class[]> {
    try {
      return await invoke('get_classes');
    } catch (error) {
      console.error('Failed to get classes:', error);
      throw error;
    }
  }

  static async createClass(classData: any): Promise<string> {
    try {
      return await invoke('create_class', { classData });
    } catch (error) {
      console.error('Failed to create class:', error);
      throw error;
    }
  }

  static async updateClass(classId: string, classData: any): Promise<void> {
    try {
      await invoke('update_class', { classId, classData });
    } catch (error) {
      console.error('Failed to update class:', error);
      throw error;
    }
  }

  static async deleteClass(classId: string): Promise<void> {
    try {
      await invoke('delete_class', { classId });
    } catch (error) {
      console.error('Failed to delete class:', error);
      throw error;
    }
  }

  static async upsertClass(classData: any): Promise<void> {
    try {
      await invoke('upsert_class', { classData });
    } catch (error) {
      console.error('Failed to upsert class:', error);
      throw error;
    }
  }

  // Students
  static async getStudents(): Promise<Student[]> {
    try {
      return await invoke('get_students');
    } catch (error) {
      console.error('Failed to get students:', error);
      throw error;
    }
  }

  static async createStudent(studentData: any): Promise<string> {
    try {
      return await invoke('create_student', { studentData });
    } catch (error) {
      console.error('Failed to create student:', error);
      throw error;
    }
  }

  static async updateStudent(studentId: string, studentData: any): Promise<void> {
    try {
      await invoke('update_student', { studentId, studentData });
    } catch (error) {
      console.error('Failed to update student:', error);
      throw error;
    }
  }

  static async deleteStudent(studentId: string): Promise<void> {
    try {
      await invoke('delete_student', { studentId });
    } catch (error) {
      console.error('Failed to delete student:', error);
      throw error;
    }
  }

  // Staff
  static async getStaff(): Promise<Staff[]> {
    try {
      return await invoke('get_staff');
    } catch (error) {
      console.error('Failed to get staff:', error);
      throw error;
    }
  }

  static async createStaff(staffData: any): Promise<string> {
    try {
      return await invoke('create_staff', { staffData });
    } catch (error) {
      console.error('Failed to create staff:', error);
      throw error;
    }
  }

  static async updateStaff(staffId: string, staffData: any): Promise<void> {
    try {
      await invoke('update_staff', { staffId, staffData });
    } catch (error) {
      console.error('Failed to update staff:', error);
      throw error;
    }
  }

  static async deleteStaff(staffId: string): Promise<void> {
    try {
      await invoke('delete_staff', { staffId });
    } catch (error) {
      console.error('Failed to delete staff:', error);
      throw error;
    }
  }

  // Library Stats
  static async getLibraryStats() {
    try {
      return await invoke('get_library_stats');
    } catch (error) {
      console.error('Failed to get library stats:', error);
      throw error;
    }
  }

  // Borrowings
  static async getBorrowings(): Promise<any[]> {
    try {
      return await invoke('get_borrowings');
    } catch (error) {
      console.error('Failed to get borrowings:', error);
      throw error;
    }
  }

  static async createBorrowing(borrowingData: any): Promise<string> {
    try {
      return await invoke('create_borrowing', { borrowingData });
    } catch (error) {
      console.error('Failed to create borrowing:', error);
      throw error;
    }
  }

  static async returnBook(borrowingId: string, returnData: any): Promise<void> {
    try {
      await invoke('return_book', { borrowingId, returnData });
    } catch (error) {
      console.error('Failed to return book:', error);
      throw error;
    }
  }

  // Group Borrowings
  static async getGroupBorrowings(): Promise<any[]> {
    try {
      return await invoke('get_group_borrowings');
    } catch (error) {
      console.error('Failed to get group borrowings:', error);
      throw error;
    }
  }

  static async createGroupBorrowing(groupBorrowingData: any): Promise<string> {
    try {
      return await invoke('create_group_borrowing', { groupBorrowingData });
    } catch (error) {
      console.error('Failed to create group borrowing:', error);
      throw error;
    }
  }

  static async updateGroupBorrowing(groupBorrowingId: string, groupBorrowingData: any): Promise<void> {
    try {
      await invoke('update_group_borrowing', { groupBorrowingId, groupBorrowingData });
    } catch (error) {
      console.error('Failed to update group borrowing:', error);
      throw error;
    }
  }

  static async returnGroupBorrowing(groupBorrowingId: string, returnData: any): Promise<void> {
    try {
      await invoke('return_group_borrowing', { groupBorrowingId, returnData });
    } catch (error) {
      console.error('Failed to return group borrowing:', error);
      throw error;
    }
  }

  static async upsertGroupBorrowing(groupBorrowingData: any): Promise<void> {
    try {
      await invoke('upsert_group_borrowing', { groupBorrowingData });
    } catch (error) {
      console.error('Failed to upsert group borrowing:', error);
      throw error;
    }
  }

  // Fines
  static async getFines(): Promise<any[]> {
    try {
      return await invoke('get_fines');
    } catch (error) {
      console.error('Failed to get fines:', error);
      throw error;
    }
  }

  static async createFine(fineData: any): Promise<string> {
    try {
      return await invoke('create_fine', { fineData });
    } catch (error) {
      console.error('Failed to create fine:', error);
      throw error;
    }
  }

  static async payFine(fineId: string, paymentData: any): Promise<void> {
    try {
      await invoke('pay_fine', { fineId, paymentData });
    } catch (error) {
      console.error('Failed to pay fine:', error);
      throw error;
    }
  }

  // Database Info
  static async getDatabaseInfo() {
    try {
      return await invoke('get_database_info');
    } catch (error) {
      console.error('Failed to get database info:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const offlineDataService = OfflineDataService;
