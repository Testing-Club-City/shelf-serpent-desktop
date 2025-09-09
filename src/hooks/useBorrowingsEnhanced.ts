import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OfflineDataService } from '@/services/offlineDataService';

// Enhanced borrowings hook that mimics the reference implementation structure
export const useBorrowingsEnhanced = (page: number = 1, pageSize: number = 50) => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['borrowings-enhanced', page, pageSize],
    queryFn: async () => {
      console.log('📚 Fetching enhanced borrowings from local database...');
      
      // Get all borrowings with full details from local database
      const allBorrowings = await OfflineDataService.getBorrowings();
      
      // Transform the data to match the reference implementation structure
      const enhancedBorrowings = allBorrowings.map((borrowing: any) => ({
        ...borrowing,
        // Ensure we have the nested structure like the reference
        students: borrowing.students ? {
          id: borrowing.students.id || borrowing.student_id,
          first_name: borrowing.students.first_name || borrowing.student_first_name,
          last_name: borrowing.students.last_name || borrowing.student_last_name,
          admission_number: borrowing.students.admission_number || borrowing.admission_number,
          class_grade: borrowing.students.class_grade || borrowing.class_grade || 'Unknown'
        } : null,
        books: borrowing.books ? {
          id: borrowing.books.id || borrowing.book_id,
          title: borrowing.books.title || borrowing.book_title,
          author: borrowing.books.author || borrowing.book_author,
          book_code: borrowing.books.book_code || borrowing.book_code
        } : null,
        book_copies: borrowing.book_copies ? {
          id: borrowing.book_copies.id || borrowing.book_copy_id,
          copy_number: borrowing.book_copies.copy_number || borrowing.copy_number,
          tracking_code: borrowing.book_copies.tracking_code || borrowing.tracking_code,
          condition: borrowing.book_copies.condition || borrowing.copy_condition,
          status: borrowing.book_copies.status || borrowing.copy_status
        } : null,
        staff: borrowing.staff ? {
          id: borrowing.staff.id || borrowing.staff_id,
          first_name: borrowing.staff.first_name || borrowing.staff_first_name,
          last_name: borrowing.staff.last_name || borrowing.staff_last_name,
          staff_id: borrowing.staff.staff_id || borrowing.staff_identifier,
          department: borrowing.staff.department || borrowing.staff_department,
          position: borrowing.staff.position || borrowing.staff_position
        } : null,
        // Ensure borrower_type is set correctly
        borrower_type: borrowing.borrower_type || (borrowing.student_id ? 'student' : 'staff')
      }));

      // Apply pagination
      const totalCount = enhancedBorrowings.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = enhancedBorrowings.slice(startIndex, endIndex);

      console.log(`📚 Enhanced borrowings fetched: ${paginatedData.length} of ${totalCount}`);
      
      return {
        data: paginatedData,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        pageSize
      };
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
};

// Enhanced overdue borrowings hook
export const useOverdueBorrowingsEnhanced = (page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['overdue-borrowings-enhanced', page, pageSize],
    queryFn: async () => {
      console.log('⏰ Fetching overdue borrowings from local database...');
      
      const allBorrowings = await OfflineDataService.getBorrowings();
      const now = new Date();
      
      // Filter for overdue borrowings
      const overdueBorrowings = allBorrowings
        .filter((borrowing: any) => {
          if (borrowing.status !== 'active' && borrowing.status !== 'borrowed') return false;
          if (!borrowing.due_date) return false;
          return new Date(borrowing.due_date) < now;
        })
        .map((borrowing: any) => ({
          ...borrowing,
          students: borrowing.students ? {
            id: borrowing.students.id || borrowing.student_id,
            first_name: borrowing.students.first_name || borrowing.student_first_name,
            last_name: borrowing.students.last_name || borrowing.student_last_name,
            admission_number: borrowing.students.admission_number || borrowing.admission_number,
            class_grade: borrowing.students.class_grade || borrowing.class_grade || 'Unknown'
          } : null,
          books: borrowing.books ? {
            id: borrowing.books.id || borrowing.book_id,
            title: borrowing.books.title || borrowing.book_title,
            author: borrowing.books.author || borrowing.book_author,
            book_code: borrowing.books.book_code || borrowing.book_code
          } : null,
          borrower_type: borrowing.borrower_type || (borrowing.student_id ? 'student' : 'staff')
        }));

      // Apply pagination
      const totalCount = overdueBorrowings.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = overdueBorrowings.slice(startIndex, endIndex);

      console.log(`⏰ Overdue borrowings fetched: ${paginatedData.length} of ${totalCount}`);
      
      return {
        data: paginatedData,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        pageSize
      };
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

// Enhanced active borrowings hook
export const useActiveBorrowingsEnhanced = () => {
  return useQuery({
    queryKey: ['active-borrowings-enhanced'],
    queryFn: async () => {
      console.log('🔄 Fetching active borrowings from local database...');
      
      const allBorrowings = await OfflineDataService.getBorrowings();
      
      const activeBorrowings = allBorrowings
        .filter((borrowing: any) => borrowing.status === 'active' || borrowing.status === 'borrowed')
        .map((borrowing: any) => ({
          ...borrowing,
          students: borrowing.students ? {
            id: borrowing.students.id || borrowing.student_id,
            first_name: borrowing.students.first_name || borrowing.student_first_name,
            last_name: borrowing.students.last_name || borrowing.student_last_name,
            admission_number: borrowing.students.admission_number || borrowing.admission_number,
            class_grade: borrowing.students.class_grade || borrowing.class_grade || 'Unknown'
          } : null,
          books: borrowing.books ? {
            id: borrowing.books.id || borrowing.book_id,
            title: borrowing.books.title || borrowing.book_title,
            author: borrowing.books.author || borrowing.book_author,
            book_code: borrowing.books.book_code || borrowing.book_code
          } : null,
          borrower_type: borrowing.borrower_type || (borrowing.student_id ? 'student' : 'staff')
        }));

      console.log(`🔄 Active borrowings fetched: ${activeBorrowings.length}`);
      return activeBorrowings;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

// Enhanced returned borrowings hook
export const useReturnedBorrowingsEnhanced = (page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['returned-borrowings-enhanced', page, pageSize],
    queryFn: async () => {
      console.log('📋 Fetching returned borrowings from local database...');
      
      const allBorrowings = await OfflineDataService.getBorrowings();
      
      const returnedBorrowings = allBorrowings
        .filter((borrowing: any) => borrowing.status === 'returned')
        .sort((a: any, b: any) => new Date(b.returned_date || b.updated_at).getTime() - new Date(a.returned_date || a.updated_at).getTime())
        .map((borrowing: any) => ({
          ...borrowing,
          students: borrowing.students ? {
            id: borrowing.students.id || borrowing.student_id,
            first_name: borrowing.students.first_name || borrowing.student_first_name,
            last_name: borrowing.students.last_name || borrowing.student_last_name,
            admission_number: borrowing.students.admission_number || borrowing.admission_number,
            class_grade: borrowing.students.class_grade || borrowing.class_grade || 'Unknown'
          } : null,
          books: borrowing.books ? {
            id: borrowing.books.id || borrowing.book_id,
            title: borrowing.books.title || borrowing.book_title,
            author: borrowing.books.author || borrowing.book_author,
            book_code: borrowing.books.book_code || borrowing.book_code
          } : null,
          borrower_type: borrowing.borrower_type || (borrowing.student_id ? 'student' : 'staff')
        }));

      // Apply pagination
      const totalCount = returnedBorrowings.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = returnedBorrowings.slice(startIndex, endIndex);

      console.log(`📋 Returned borrowings fetched: ${paginatedData.length} of ${totalCount}`);
      
      return {
        data: paginatedData,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        pageSize
      };
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

// Create borrowing mutation
export const useCreateBorrowingEnhanced = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (borrowingData: any) => {
      console.log('📚 Creating borrowing:', borrowingData);
      return await OfflineDataService.createBorrowing(borrowingData);
    },
    onSuccess: () => {
      // Invalidate all borrowing-related queries
      queryClient.invalidateQueries({ queryKey: ['borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['active-borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['returned-borrowings-enhanced'] });
      
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
};

// Return book mutation
export const useReturnBookEnhanced = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ borrowingId, returnData }: { borrowingId: string; returnData: any }) => {
      console.log('📚 Returning book:', borrowingId, returnData);
      return await OfflineDataService.returnBook(borrowingId, returnData);
    },
    onSuccess: () => {
      // Invalidate all borrowing-related queries
      queryClient.invalidateQueries({ queryKey: ['borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['active-borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['returned-borrowings-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      
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
};
