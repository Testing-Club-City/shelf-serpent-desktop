import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { EnhancedBorrowingService, EnhancedBorrowingData } from '@/services/enhancedBorrowingService';
import { logBorrowing } from '@/lib/activityLogger';

/**
 * Enhanced hook for creating borrowings with improved validation and error handling
 */
export const useCreateEnhancedBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (borrowingData: EnhancedBorrowingData) => {
      console.log('🚀 Enhanced borrowing creation started');
      return await EnhancedBorrowingService.createBorrowing(borrowingData);
    },
    onSuccess: (borrowingId: string) => {
      console.log('✅ Enhanced borrowing created successfully:', borrowingId);
      
      // Invalidate all borrowing-related queries
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['active-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      
      toast({
        title: "Success",
        description: "Book issued successfully with enhanced validation",
      });
    },
    onError: (error: any) => {
      console.error('❌ Enhanced borrowing creation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};

/**
 * Enhanced hook for creating multiple borrowings
 */
export const useCreateMultipleEnhancedBorrowings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (borrowingsData: EnhancedBorrowingData[]) => {
      console.log('🚀 Enhanced multiple borrowings creation started:', borrowingsData.length);
      return await EnhancedBorrowingService.createMultipleBorrowings(borrowingsData);
    },
    onSuccess: (borrowingIds: string[], borrowingsData: EnhancedBorrowingData[]) => {
      console.log('✅ Enhanced multiple borrowings created successfully:', borrowingIds);
      
      // Log each borrowing activity
      borrowingsData.forEach(async (borrowing, index) => {
        try {
          const borrowerId = borrowing.student_id || borrowing.staff_id || '';
          const borrowerType = borrowing.borrower_type || (borrowing.student_id ? 'student' : 'staff');
          
          await logBorrowing.issued(
            borrowingIds[index],
            `Tracking: ${borrowing.tracking_code}`,
            borrowerId,
            borrowerType as 'student' | 'staff'
          );
        } catch (logError) {
          console.error('Failed to log borrowing activity:', logError);
        }
      });
      
      // Invalidate all borrowing-related queries
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['active-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      
      toast({
        title: "Success",
        description: `Successfully issued ${borrowingIds.length} book(s) with enhanced validation`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Enhanced multiple borrowings creation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook for searching book copies with enhanced validation
 */
export const useEnhancedBookCopySearch = () => {
  return useMutation({
    mutationFn: async (searchTerm: string) => {
      console.log('🔍 Enhanced book copy search started:', searchTerm);
      return await EnhancedBorrowingService.searchBookCopy(searchTerm);
    },
    onError: (error: any) => {
      console.error('❌ Enhanced book copy search failed:', error);
    },
  });
};

/**
 * Hook for checking borrowing limits
 */
export const useCheckBorrowingLimits = () => {
  return useMutation({
    mutationFn: async (studentId: string) => {
      console.log('📊 Checking borrowing limits for student:', studentId);
      return await EnhancedBorrowingService.checkBorrowingLimits(studentId);
    },
    onError: (error: any) => {
      console.warn('⚠️ Could not check borrowing limits:', error);
    },
  });
};