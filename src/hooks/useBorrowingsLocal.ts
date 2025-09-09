import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OfflineDataService } from '@/services/offlineDataService';

// Local borrowings hook that reads from SQLite database
export const useBorrowingsLocal = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all borrowings from local database
  const {
    data: borrowings = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['borrowings-local'],
    queryFn: async () => {
      console.log('📚 Fetching borrowings from local database...');
      const data = await OfflineDataService.getBorrowings();
      console.log('📚 Fetched borrowings:', data.length);
      return data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Create borrowing mutation
  const createBorrowingMutation = useMutation({
    mutationFn: async (borrowingData: any) => {
      console.log('📚 Creating borrowing:', borrowingData);
      return await OfflineDataService.createBorrowing(borrowingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings-local'] });
      toast({
        title: "Success",
        description: "Borrowing created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Failed to create borrowing:', error);
      toast({
        title: "Error",
        description: `Failed to create borrowing: ${error.message || error}`,
        variant: "destructive",
      });
    },
  });

  // Return book mutation
  const returnBookMutation = useMutation({
    mutationFn: async ({ borrowingId, returnData }: { borrowingId: string; returnData: any }) => {
      console.log('📚 Returning book:', borrowingId, returnData);
      return await OfflineDataService.returnBook(borrowingId, returnData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings-local'] });
      toast({
        title: "Success",
        description: "Book returned successfully",
      });
    },
    onError: (error: any) => {
      console.error('Failed to return book:', error);
      toast({
        title: "Error",
        description: `Failed to return book: ${error.message || error}`,
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const getActiveBorrowings = () => {
    return borrowings.filter((b: any) => b.status === 'active' || b.status === 'borrowed');
  };

  const getOverdueBorrowings = () => {
    const now = new Date();
    return borrowings.filter((b: any) => {
      if (b.status !== 'active' && b.status !== 'borrowed') return false;
      if (!b.due_date) return false;
      return new Date(b.due_date) < now;
    });
  };

  const getReturnedBorrowings = () => {
    return borrowings.filter((b: any) => b.status === 'returned');
  };

  const getBorrowingsByStudent = (studentId: string) => {
    return borrowings.filter((b: any) => b.student_id === studentId);
  };

  const getActiveBorrowingsByStudent = (studentId: string) => {
    return borrowings.filter((b: any) => 
      b.student_id === studentId && (b.status === 'active' || b.status === 'borrowed')
    );
  };

  return {
    // Data
    borrowings,
    isLoading,
    error,
    
    // Mutations
    createBorrowing: createBorrowingMutation.mutate,
    returnBook: returnBookMutation.mutate,
    isCreating: createBorrowingMutation.isPending,
    isReturning: returnBookMutation.isPending,
    
    // Helper functions
    getActiveBorrowings,
    getOverdueBorrowings,
    getReturnedBorrowings,
    getBorrowingsByStudent,
    getActiveBorrowingsByStudent,
    
    // Utilities
    refetch,
  };
};

// Hook for getting borrowings by student ID
export const useStudentBorrowings = (studentId: string) => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['student-borrowings-local', studentId],
    queryFn: async () => {
      console.log('📚 Fetching borrowings for student:', studentId);
      const studentBorrowings = await OfflineDataService.getBorrowingsByStudent(studentId);
      console.log('📚 Found borrowings for student:', studentBorrowings.length);
      return studentBorrowings;
    },
    enabled: !!studentId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for getting active borrowings count
export const useActiveBorrowingsCount = () => {
  return useQuery({
    queryKey: ['active-borrowings-count-local'],
    queryFn: async () => {
      const borrowings = await OfflineDataService.getBorrowings();
      return borrowings.filter((b: any) => b.status === 'active' || b.status === 'borrowed').length;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for getting overdue borrowings count
export const useOverdueBorrowingsCount = () => {
  return useQuery({
    queryKey: ['overdue-borrowings-count-local'],
    queryFn: async () => {
      const borrowings = await OfflineDataService.getBorrowings();
      const now = new Date();
      return borrowings.filter((b: any) => {
        if (b.status !== 'active' && b.status !== 'borrowed') return false;
        if (!b.due_date) return false;
        return new Date(b.due_date) < now;
      }).length;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};
