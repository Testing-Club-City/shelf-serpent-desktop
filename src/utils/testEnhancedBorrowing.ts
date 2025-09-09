import { EnhancedBorrowingService, EnhancedBorrowingData } from '@/services/enhancedBorrowingService';

/**
 * Test utility for enhanced borrowing functionality
 */
export class EnhancedBorrowingTester {
  /**
   * Test borrowing data validation
   */
  static testValidation() {
    console.log('🧪 Testing Enhanced Borrowing Validation');

    // Test valid data
    const validData: EnhancedBorrowingData = {
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      borrower_type: 'student',
      book_id: '123e4567-e89b-12d3-a456-426614174001',
      book_copy_id: '123e4567-e89b-12d3-a456-426614174002',
      tracking_code: 'BK001',
      borrowed_date: '2025-01-20',
      due_date: '2025-02-03',
      condition_at_issue: 'good',
      status: 'active'
    };

    const validResult = EnhancedBorrowingService.validateBorrowingData(validData);
    console.log('✅ Valid data test:', validResult);

    // Test invalid data
    const invalidData: EnhancedBorrowingData = {
      student_id: 'invalid-uuid',
      borrower_type: 'student',
      book_id: '',
      book_copy_id: '',
      tracking_code: '',
      borrowed_date: '2025-02-03',
      due_date: '2025-01-20', // Due date before borrowed date
      condition_at_issue: 'good',
      status: 'active'
    };

    const invalidResult = EnhancedBorrowingService.validateBorrowingData(invalidData);
    console.log('❌ Invalid data test:', invalidResult);

    return { validResult, invalidResult };
  }

  /**
   * Test data preparation
   */
  static testDataPreparation() {
    console.log('🧪 Testing Enhanced Borrowing Data Preparation');

    const rawData = {
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      borrower_type: 'student',
      book_id: '123e4567-e89b-12d3-a456-426614174001',
      book_copy_id: '123e4567-e89b-12d3-a456-426614174002',
      tracking_code: '  BK001  ', // With whitespace
      borrowed_date: '2025-01-20',
      due_date: '2025-02-03',
      condition_at_issue: '',
      notes: '  Some notes  ',
      status: ''
    };

    const preparedData = EnhancedBorrowingService.prepareBorrowingData(rawData);
    console.log('📝 Prepared data:', preparedData);

    return preparedData;
  }

  /**
   * Test book copy data normalization
   */
  static testBookCopyNormalization() {
    console.log('🧪 Testing Book Copy Data Normalization');

    // Test with complete data
    const completeData = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      book_id: '123e4567-e89b-12d3-a456-426614174001',
      tracking_code: 'BK001',
      status: 'available',
      condition: 'good',
      legacy_book_id: 1001,
      copy_number: 1,
      title: 'Test Book',
      author: 'Test Author',
      isbn: '978-0123456789'
    };

    const normalizedComplete = EnhancedBorrowingService.normalizeBookCopyData(completeData);
    console.log('✅ Normalized complete data:', normalizedComplete);

    // Test with minimal data
    const minimalData = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      status: 'available',
      legacy_book_id: 1001
    };

    const normalizedMinimal = EnhancedBorrowingService.normalizeBookCopyData(minimalData);
    console.log('📝 Normalized minimal data:', normalizedMinimal);

    // Test with unavailable book
    const unavailableData = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      status: 'borrowed',
      legacy_book_id: 1001
    };

    const normalizedUnavailable = EnhancedBorrowingService.normalizeBookCopyData(unavailableData);
    console.log('❌ Normalized unavailable data:', normalizedUnavailable);

    return { normalizedComplete, normalizedMinimal, normalizedUnavailable };
  }

  /**
   * Run all tests
   */
  static runAllTests() {
    console.log('🚀 Running All Enhanced Borrowing Tests');
    console.log('=====================================');

    try {
      const validationTests = this.testValidation();
      const preparationTest = this.testDataPreparation();
      const normalizationTests = this.testBookCopyNormalization();

      console.log('=====================================');
      console.log('✅ All Enhanced Borrowing Tests Completed');

      return {
        validation: validationTests,
        preparation: preparationTest,
        normalization: normalizationTests
      };
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }
}

// Export for use in development/testing
if (typeof window !== 'undefined') {
  (window as any).EnhancedBorrowingTester = EnhancedBorrowingTester;
}