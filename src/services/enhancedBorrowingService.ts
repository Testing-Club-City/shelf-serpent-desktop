import { invoke } from '@tauri-apps/api/core';

export interface EnhancedBorrowingData {
  student_id?: string;
  staff_id?: string;
  borrower_type: 'student' | 'staff';
  book_id: string;
  book_copy_id: string;
  tracking_code: string;
  borrowed_date: string;
  due_date: string;
  condition_at_issue: string;
  notes?: string;
  status: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EnhancedBorrowingService {
  /**
   * Validate borrowing data before submission
   */
  static validateBorrowingData(borrowingData: EnhancedBorrowingData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!borrowingData.borrower_type) {
      errors.push('Borrower type is required');
    }

    if (borrowingData.borrower_type === 'student' && !borrowingData.student_id) {
      errors.push('Student ID is required for student borrowings');
    }

    if (borrowingData.borrower_type === 'staff' && !borrowingData.staff_id) {
      errors.push('Staff ID is required for staff borrowings');
    }

    if (!borrowingData.book_id) {
      errors.push('Book ID is required');
    }

    if (!borrowingData.book_copy_id) {
      errors.push('Book copy ID is required');
    }

    if (!borrowingData.tracking_code) {
      errors.push('Tracking code is required');
    }

    if (!borrowingData.borrowed_date) {
      errors.push('Borrowed date is required');
    }

    if (!borrowingData.due_date) {
      errors.push('Due date is required');
    }

    // Date validation
    if (borrowingData.borrowed_date && borrowingData.due_date) {
      const borrowedDate = new Date(borrowingData.borrowed_date);
      const dueDate = new Date(borrowingData.due_date);

      if (dueDate <= borrowedDate) {
        errors.push('Due date must be after borrowed date');
      }

      // Check if borrowed date is in the future (warning only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      borrowedDate.setHours(0, 0, 0, 0);

      if (borrowedDate > today) {
        warnings.push('Borrowed date is in the future');
      }
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (borrowingData.student_id && !uuidRegex.test(borrowingData.student_id)) {
      errors.push('Invalid student ID format (must be UUID)');
    }

    if (borrowingData.staff_id && !uuidRegex.test(borrowingData.staff_id)) {
      errors.push('Invalid staff ID format (must be UUID)');
    }

    if (borrowingData.book_id && !uuidRegex.test(borrowingData.book_id)) {
      errors.push('Invalid book ID format (must be UUID)');
    }

    if (borrowingData.book_copy_id && !uuidRegex.test(borrowingData.book_copy_id)) {
      errors.push('Invalid book copy ID format (must be UUID)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize and prepare borrowing data for submission
   */
  static prepareBorrowingData(rawData: any): EnhancedBorrowingData {
    return {
      student_id: rawData.student_id || null,
      staff_id: rawData.staff_id || null,
      borrower_type: rawData.borrower_type || 'student',
      book_id: rawData.book_id,
      book_copy_id: rawData.book_copy_id,
      tracking_code: rawData.tracking_code?.toString() || '',
      borrowed_date: rawData.borrowed_date,
      due_date: rawData.due_date,
      condition_at_issue: rawData.condition_at_issue || 'good',
      notes: rawData.notes?.trim() || null,
      status: rawData.status || 'active'
    };
  }

  /**
   * Enhanced book copy search with multiple strategies
   */
  static async searchBookCopy(searchTerm: string): Promise<any | null> {
    console.log('🔍 Enhanced book copy search for:', searchTerm);
    
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return null;
    }

    try {
      let result = null;

      // Strategy 1: Search by legacy book ID if numeric
      if (!isNaN(parseInt(trimmedTerm))) {
        try {
          console.log('📊 Searching by legacy book ID:', trimmedTerm);
          result = await invoke('search_book_copy_by_legacy_id', {
            legacyBookId: parseInt(trimmedTerm, 10)
          });
          
          if (result) {
            console.log('✅ Found by legacy ID:', result);
            return this.normalizeBookCopyData(result);
          }
        } catch (e) {
          console.log('⚠️ Legacy ID search failed:', e);
        }
      }

      // Strategy 2: Search by tracking code
      try {
        console.log('🏷️ Searching by tracking code:', trimmedTerm);
        result = await invoke('search_book_copy_by_tracking_code', {
          trackingCode: trimmedTerm
        });
        
        if (result) {
          console.log('✅ Found by tracking code:', result);
          return this.normalizeBookCopyData(result);
        }
      } catch (e) {
        console.log('⚠️ Tracking code search failed:', e);
      }

      // Strategy 3: General search
      try {
        console.log('🔎 General book copy search:', trimmedTerm);
        result = await invoke('search_book_copy', {
          query: trimmedTerm
        });
        
        if (result) {
          console.log('✅ Found by general search:', result);
          return this.normalizeBookCopyData(result);
        }
      } catch (e) {
        console.log('⚠️ General search failed:', e);
      }

      // Strategy 4: Search available book copies
      try {
        console.log('📚 Searching available book copies:', trimmedTerm);
        const availableCopies = await invoke('get_available_book_copies');
        
        if (Array.isArray(availableCopies)) {
          const matchingCopy = availableCopies.find((copy: any) => 
            copy.tracking_code === trimmedTerm ||
            copy.legacy_book_id?.toString() === trimmedTerm ||
            copy.id === trimmedTerm
          );
          
          if (matchingCopy) {
            console.log('✅ Found in available copies:', matchingCopy);
            return this.normalizeBookCopyData(matchingCopy);
          }
        }
      } catch (e) {
        console.log('⚠️ Available copies search failed:', e);
      }

      console.log('❌ Book copy not found with any search strategy');
      return null;

    } catch (error) {
      console.error('❌ Enhanced book copy search failed:', error);
      return null;
    }
  }

  /**
   * Normalize book copy data to ensure consistent structure
   */
  static normalizeBookCopyData(rawData: any): any {
    if (!rawData) return null;

    // Check if book is available
    if (rawData.status !== 'available') {
      console.log('⚠️ Book copy is not available:', rawData.status);
      return null;
    }

    return {
      id: rawData.id,
      book_id: rawData.book_id || rawData.id,
      tracking_code: rawData.tracking_code || rawData.legacy_book_id?.toString() || '',
      status: rawData.status || 'available',
      condition: rawData.condition || 'good',
      legacy_book_id: rawData.legacy_book_id,
      copy_number: rawData.copy_number || 1,
      books: {
        id: rawData.book_id || rawData.id,
        title: rawData.title || rawData.book_title || `Book ${rawData.tracking_code || rawData.legacy_book_id}`,
        author: rawData.author || rawData.book_author || 'Unknown Author',
        isbn: rawData.isbn || rawData.book_isbn || '',
        book_code: rawData.book_code || ''
      }
    };
  }

  /**
   * Create borrowing with enhanced error handling
   */
  static async createBorrowing(borrowingData: EnhancedBorrowingData): Promise<string> {
    console.log('📚 Creating enhanced borrowing:', borrowingData);

    // Validate data first
    const validation = this.validateBorrowingData(borrowingData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Borrowing warnings:', validation.warnings);
    }

    try {
      // Prepare data for Tauri command
      const preparedData = this.prepareBorrowingData(borrowingData);
      
      console.log('📝 Prepared borrowing data:', preparedData);

      // Call Tauri command
      const borrowingId = await invoke('create_borrowing', {
        borrowingData: preparedData
      });

      console.log('✅ Enhanced borrowing created successfully:', borrowingId);
      return borrowingId as string;

    } catch (error) {
      console.error('❌ Enhanced borrowing creation failed:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('UUID')) {
        throw new Error('Invalid ID format. Please ensure all IDs are properly formatted.');
      } else if (errorMessage.includes('constraint')) {
        throw new Error('Database constraint violation. The book may already be borrowed or data is inconsistent.');
      } else if (errorMessage.includes('not found')) {
        throw new Error('Referenced book, student, or staff not found in the database.');
      } else {
        throw new Error(`Failed to create borrowing: ${errorMessage}`);
      }
    }
  }

  /**
   * Create multiple borrowings with transaction-like behavior
   */
  static async createMultipleBorrowings(borrowingsData: EnhancedBorrowingData[]): Promise<string[]> {
    console.log('📚 Creating multiple enhanced borrowings:', borrowingsData.length);

    const results: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < borrowingsData.length; i++) {
      try {
        const borrowingId = await this.createBorrowing(borrowingsData[i]);
        results.push(borrowingId);
        console.log(`✅ Borrowing ${i + 1}/${borrowingsData.length} created: ${borrowingId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Borrowing ${i + 1}: ${errorMessage}`);
        console.error(`❌ Borrowing ${i + 1}/${borrowingsData.length} failed:`, error);
      }
    }

    if (errors.length > 0) {
      console.error('❌ Some borrowings failed:', errors);
      throw new Error(`Failed to create ${errors.length} borrowing(s): ${errors.join('; ')}`);
    }

    console.log('✅ All enhanced borrowings created successfully');
    return results;
  }

  /**
   * Check borrowing limits for a student
   */
  static async checkBorrowingLimits(studentId: string): Promise<{
    currentBorrowings: number;
    maxAllowed: number;
    canBorrow: boolean;
  }> {
    try {
      const result = await invoke('check_student_borrowing_limits', {
        studentId
      });

      return result as any;
    } catch (error) {
      console.warn('⚠️ Could not check borrowing limits:', error);
      // Return default values if check fails
      return {
        currentBorrowings: 0,
        maxAllowed: 3,
        canBorrow: true
      };
    }
  }
}