# Enhanced Borrowing System

## Overview

The Enhanced Borrowing System is a comprehensive solution that addresses the data creation and joining issues in the desktop library management application. It provides robust validation, error handling, and improved user experience based on the successful web version implementation.

## Key Features

### 🔧 **Enhanced Data Validation**
- **UUID Format Validation**: Ensures all ID fields are properly formatted UUIDs
- **Required Field Validation**: Validates all mandatory fields before submission
- **Date Validation**: Ensures logical date relationships (due date after borrowed date)
- **Book Availability Check**: Verifies books are available before issuing

### 🚀 **Improved User Experience**
- **Multi-Strategy Search**: Uses multiple search strategies to find books and borrowers
- **Real-time Validation**: Provides immediate feedback on form inputs
- **Enhanced Error Messages**: Clear, actionable error messages
- **Progress Indicators**: Visual feedback during processing

### 📚 **Robust Book Copy Search**
- **Legacy ID Search**: Searches by numeric legacy book IDs
- **Tracking Code Search**: Searches by book tracking codes
- **General Search**: Fallback general search functionality
- **Available Copies Filter**: Only shows available book copies

### 🔄 **Multiple Borrowing Support**
- **Batch Processing**: Create multiple borrowings in a single transaction
- **Individual Validation**: Each borrowing is validated independently
- **Partial Success Handling**: Handles cases where some borrowings succeed and others fail

## Architecture

### Components

1. **EnhancedBorrowingForm.tsx**
   - Main form component with enhanced validation
   - Real-time search and validation
   - Multiple book selection support
   - Comprehensive error handling

2. **EnhancedBorrowingService.ts**
   - Core business logic and validation
   - Book copy search strategies
   - Data normalization and preparation
   - Error handling and messaging

3. **useEnhancedBorrowings.ts**
   - React hooks for enhanced borrowing operations
   - Query invalidation and cache management
   - Toast notifications and error handling

### Data Flow

```
User Input → Form Validation → Service Validation → Tauri Command → Database → Response
     ↓              ↓                    ↓              ↓            ↓         ↓
Real-time     Client-side        Server-side      Rust Backend   SQLite    Success/Error
Feedback      Validation         Validation       Processing     Storage   Notification
```

## Key Improvements Over Standard Form

### 1. **Enhanced Validation**

**Standard Form:**
```typescript
// Basic validation
if (!selectedBorrower) {
  alert('Please select a borrower');
  return;
}
```

**Enhanced Form:**
```typescript
// Comprehensive validation
const validateBorrowingData = (borrowings: any[]): string[] => {
  const errors: string[] = [];
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  borrowings.forEach((borrowing, index) => {
    if (borrowing.student_id && !uuidRegex.test(borrowing.student_id)) {
      errors.push(`Item ${index + 1}: Invalid student ID format`);
    }
    // ... more validations
  });
  
  return errors;
};
```

### 2. **Multi-Strategy Book Search**

**Standard Form:**
```typescript
// Single search strategy
const result = await invoke('search_book_copy_by_legacy_id', {
  legacyBookId: parseInt(trimmedCode, 10)
});
```

**Enhanced Form:**
```typescript
// Multiple search strategies with fallbacks
static async searchBookCopy(searchTerm: string): Promise<any | null> {
  let result = null;
  
  // Strategy 1: Legacy ID search
  if (!isNaN(parseInt(trimmedTerm))) {
    result = await invoke('search_book_copy_by_legacy_id', { ... });
  }
  
  // Strategy 2: Tracking code search
  if (!result) {
    result = await invoke('search_book_copy_by_tracking_code', { ... });
  }
  
  // Strategy 3: General search
  if (!result) {
    result = await invoke('search_book_copy', { ... });
  }
  
  return this.normalizeBookCopyData(result);
}
```

### 3. **Comprehensive Error Handling**

**Standard Form:**
```typescript
// Basic error handling
} catch (error) {
  console.error('Error:', error);
  alert('Failed to issue book');
}
```

**Enhanced Form:**
```typescript
// Detailed error handling with specific messages
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('UUID')) {
    throw new Error('Invalid ID format. Please ensure all IDs are properly formatted.');
  } else if (errorMessage.includes('constraint')) {
    throw new Error('Database constraint violation. The book may already be borrowed.');
  } else if (errorMessage.includes('not found')) {
    throw new Error('Referenced book, student, or staff not found in the database.');
  } else {
    throw new Error(`Failed to create borrowing: ${errorMessage}`);
  }
}
```

## Usage

### 1. **Basic Usage**

```typescript
import { EnhancedBorrowingForm } from '@/components/borrowing/EnhancedBorrowingForm';

// In your component
<EnhancedBorrowingForm
  onSubmit={handleBorrowingSubmit}
  onCancel={() => setShowForm(false)}
/>
```

### 2. **Using the Service Directly**

```typescript
import { EnhancedBorrowingService } from '@/services/enhancedBorrowingService';

// Validate data
const validation = EnhancedBorrowingService.validateBorrowingData(borrowingData);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Create borrowing
const borrowingId = await EnhancedBorrowingService.createBorrowing(borrowingData);
```

### 3. **Using the Hooks**

```typescript
import { useCreateMultipleEnhancedBorrowings } from '@/hooks/useEnhancedBorrowings';

const createBorrowings = useCreateMultipleEnhancedBorrowings();

const handleSubmit = async (borrowingsData) => {
  try {
    await createBorrowings.mutateAsync(borrowingsData);
  } catch (error) {
    // Error handling is done by the hook
  }
};
```

## Testing

### Running Tests

```typescript
import { EnhancedBorrowingTester } from '@/utils/testEnhancedBorrowing';

// Run all tests
const results = EnhancedBorrowingTester.runAllTests();

// Run specific tests
const validationResults = EnhancedBorrowingTester.testValidation();
const preparationResults = EnhancedBorrowingTester.testDataPreparation();
```

### Test Coverage

- ✅ Data validation (valid and invalid cases)
- ✅ Data preparation and sanitization
- ✅ Book copy data normalization
- ✅ UUID format validation
- ✅ Date validation
- ✅ Error message generation

## Configuration

### Form Selection

The BorrowingManagement component now includes both forms:

```typescript
// Toggle between forms
const [useEnhancedForm, setUseEnhancedForm] = useState(true);

// Render appropriate form
{useEnhancedForm ? (
  <EnhancedBorrowingForm ... />
) : (
  <NewBorrowingForm ... />
)}
```

### Validation Rules

Customize validation rules in `EnhancedBorrowingService`:

```typescript
// Modify UUID regex for different formats
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Add custom validation rules
if (customCondition) {
  errors.push('Custom validation error');
}
```

## Troubleshooting

### Common Issues

1. **UUID Format Errors**
   - **Problem**: "Invalid UUID format" errors
   - **Solution**: Ensure all ID fields are properly formatted UUIDs
   - **Check**: Use the validation function to verify UUID format

2. **Book Not Found**
   - **Problem**: Book copy search returns null
   - **Solution**: Verify the book exists and is available
   - **Check**: Use multiple search strategies in the service

3. **Database Constraint Violations**
   - **Problem**: Foreign key constraint errors
   - **Solution**: Ensure referenced entities exist
   - **Check**: Validate student/staff/book existence before creating borrowing

### Debug Mode

Enable debug logging:

```typescript
// In your component
console.log('🔍 Enhanced borrowing debug mode enabled');

// The service automatically logs detailed information
// Check browser console for detailed logs
```

## Migration Guide

### From Standard to Enhanced Form

1. **Update Imports**
   ```typescript
   // Old
   import { NewBorrowingForm } from './NewBorrowingForm';
   
   // New
   import { EnhancedBorrowingForm } from './EnhancedBorrowingForm';
   import { useCreateMultipleEnhancedBorrowings } from '@/hooks/useEnhancedBorrowings';
   ```

2. **Update Hook Usage**
   ```typescript
   // Old
   const createBorrowing = useCreateBorrowingEnhanced();
   
   // New
   const createBorrowings = useCreateMultipleEnhancedBorrowings();
   ```

3. **Update Submit Handler**
   ```typescript
   // Old
   for (const borrowing of borrowings) {
     await createBorrowing.mutateAsync(borrowing);
   }
   
   // New
   await createBorrowings.mutateAsync(borrowings);
   ```

## Performance Considerations

- **Validation**: Client-side validation reduces server round trips
- **Batch Processing**: Multiple borrowings processed efficiently
- **Caching**: Query results cached for better performance
- **Debounced Search**: Reduces API calls during user input

## Security Features

- **Input Sanitization**: All inputs are sanitized before processing
- **UUID Validation**: Prevents injection attacks through ID fields
- **Data Normalization**: Ensures consistent data format
- **Error Message Sanitization**: Prevents information leakage

## Future Enhancements

- [ ] QR Code scanning for book tracking codes
- [ ] Bulk borrowing from CSV/Excel files
- [ ] Advanced borrowing limits based on user roles
- [ ] Integration with barcode scanners
- [ ] Mobile-responsive design improvements
- [ ] Offline synchronization capabilities

## Support

For issues or questions about the Enhanced Borrowing System:

1. Check the troubleshooting section above
2. Run the test suite to identify issues
3. Enable debug logging for detailed information
4. Review the validation errors for specific guidance

The Enhanced Borrowing System provides a robust, user-friendly solution for library book management with comprehensive error handling and validation.