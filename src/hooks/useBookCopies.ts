import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';

interface UseBookCopiesOptions {
  page?: number;
  pageSize?: number;
  bookId?: string;
  legacyBookId?: number | string;
  searchTerm?: string;
}

export const useBookCopies = ({ 
  page = 1, 
  pageSize = 10, 
  bookId, 
  legacyBookId,
  searchTerm
}: UseBookCopiesOptions = {}) => {
  return useQuery({
    queryKey: ['book-copies', bookId, legacyBookId, searchTerm, page, pageSize],
    queryFn: async () => {
      console.log(`Fetching book copies:`, { bookId, legacyBookId, searchTerm, page, pageSize });
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('book_copies')
        .select(
          `
          *,
          books (
            id,
            title,
            author,
            book_code,
            isbn,
            total_copies,
            available_copies,
            legacy_book_id
          )
        `,
          { count: 'exact' }
        )
        .order('copy_number')
        .range(from, to);

      if (bookId) {
        query = query.eq('book_id', bookId);
      } else if (legacyBookId) {
        // Convert legacyBookId to number if it's a string
        const legacyId = typeof legacyBookId === 'string' ? parseInt(legacyBookId, 10) : legacyBookId;
        
        if (!isNaN(legacyId)) {
          // Search in both books.legacy_book_id and book_copies.legacy_book_id
          const { data: bookData } = await supabase
            .from('books')
            .select('id')
            .eq('legacy_book_id', legacyId)
            .maybeSingle();
            
          if (bookData) {
            // If book found by legacy_book_id, search by book_id
            query = query.eq('book_id', bookData.id);
          } else {
            // If no book found, search in book_copies.legacy_book_id
            query = query.eq('legacy_book_id', legacyId);
          }
        }
      }
      
      if (searchTerm) {
        // Convert searchTerm to number for legacy_book_id comparison if it's a valid number
        const legacyId = Number(searchTerm);
        const isLegacyIdSearch = !isNaN(legacyId) && searchTerm.trim() !== '';
        
        if (isLegacyIdSearch) {
          console.log(`Searching for legacy book ID: ${legacyId}`);
          
          // First, try to find books with this legacy ID
          const { data: booksByLegacyId } = await supabase
            .from('books')
            .select('id')
            .eq('legacy_book_id', legacyId);
            
          console.log('Books found by legacy ID:', booksByLegacyId);
          
          if (booksByLegacyId && booksByLegacyId.length > 0) {
            // If we found books with this legacy ID, search by their IDs
            const bookIds = booksByLegacyId.map(b => b.id);
            console.log('Searching for book copies with book IDs:', bookIds);
            query = query.in('book_id', bookIds);
          } else {
            // If no books found, search in book_copies.legacy_book_id
            console.log('No books found with legacy ID, searching in book_copies');
            query = query.eq('legacy_book_id', legacyId);
          }
        } else {
          // For regular text search
          console.log(`Performing text search for: ${searchTerm}`);
          const searchConditions = [
            `book_code.ilike.%${searchTerm}%`,
            `books.title.ilike.%${searchTerm}%`,
            `books.author.ilike.%${searchTerm}%`,
            `books.isbn.ilike.%${searchTerm}%`,
            `books.legacy_book_id.cast(text).ilike.%${searchTerm}%`,
            `legacy_book_id.cast(text).ilike.%${searchTerm}%`
          ];
          query = query.or(searchConditions.join(','));
        }
      }

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching book copies:', error);
        throw error;
      }
      
      console.log(`Book copies fetched successfully: ${data?.length || 0} copies (page ${page})`);
      console.log('Available copies:', data?.filter(copy => copy.status === 'available')?.length || 0);
      
      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    enabled: !!bookId || bookId === undefined,
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useAvailableBookCopies = (bookId?: string) => {
  return useQuery({
    queryKey: ['available-book-copies', bookId],
    queryFn: async () => {
      console.log('Fetching available book copies for book:', bookId);
      
      let query = supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            book_code,
            isbn,
            total_copies,
            available_copies
          )
        `)
        .eq('status', 'available')
        .order('book_id, copy_number');

      if (bookId) {
        query = query.eq('book_id', bookId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching available book copies:', error);
        throw error;
      }
      
      console.log('Available book copies fetched successfully:', data?.length || 0, 'copies');
      
      // Group by book to show availability per book
      const bookAvailability = data?.reduce((acc, copy) => {
        const bookId = copy.book_id;
        if (!acc[bookId]) {
          acc[bookId] = [];
        }
        acc[bookId].push(copy);
        return acc;
      }, {} as Record<string, any[]>);
      
      console.log('Book availability mapping:', Object.keys(bookAvailability || {}).length, 'books with available copies');
      
      return data;
    },
    enabled: !!bookId || bookId === undefined,
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useCreateBookCopies = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async ({ 
      bookId, 
      totalCopies, 
      bookCode, 
      condition = 'good',
      startingCopyNumber,
      year
    }: { 
      bookId: string; 
      totalCopies: number; 
      bookCode: string;
      condition?: string;
      startingCopyNumber?: number;
      year?: string;
    }) => {
      console.log('Creating book copies...');
      
      // Get existing copies count to determine starting copy number
      const { data: existingCopies, error: fetchError } = await supabase
        .from('book_copies')
        .select('copy_number')
        .eq('book_id', bookId)
        .order('copy_number', { ascending: false })
        .limit(1);
        
      if (fetchError) {
        console.error('Error fetching existing copies:', fetchError);
        throw fetchError;
      }
      
      // Determine the starting copy number
      let nextCopyNumber = startingCopyNumber || 1;
      if (!startingCopyNumber && existingCopies && existingCopies.length > 0) {
        nextCopyNumber = Math.max(nextCopyNumber, existingCopies[0].copy_number + 1);
      }
      
      // Create the copies using the proper format: BookCode/CopyNumber/Year
      const copies = [];
      const currentYear = year || new Date().getFullYear().toString().slice(-2); // Get last 2 digits of year or use provided year
      
      for (let i = 0; i < totalCopies; i++) {
        const copyNumber = nextCopyNumber + i;
        const paddedCopyNumber = String(copyNumber).padStart(3, '0');
        const trackingCode = `${bookCode}/${paddedCopyNumber}/${currentYear}`;
        
        copies.push({
          book_id: bookId,
          copy_number: copyNumber,
          book_code: bookCode,
          tracking_code: trackingCode,
          condition: condition,
          status: 'available'
        });
      }

      console.log('Inserting copies with tracking codes:', copies);

      const { data, error } = await supabase
        .from('book_copies')
        .insert(copies)
        .select();

      if (error) {
        console.error('Error creating book copies:', error);
        throw error;
      }
      
      // Update the book's total_copies and available_copies count
      await updateBookAvailableCopies(bookId);
      
      // Log the action
      createLog.mutate({
        action_type: 'book_copies_created',
        resource_type: 'book',
        resource_id: bookId,
        details: {
          book_code: bookCode,
          copies_created: totalCopies,
          starting_copy_number: nextCopyNumber,
          ending_copy_number: nextCopyNumber + totalCopies - 1,
          year: currentYear
        }
      });
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['available-book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast({
        title: 'Success',
        description: `${data.length} book copies created successfully`,
      });
    },
    onError: (error) => {
      console.error('Error creating book copies:', error);
      toast({
        title: 'Error',
        description: `Failed to create book copies: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateBookCopy = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      condition 
    }: { 
      id: string; 
      status?: string; 
      condition?: string;
    }) => {
      console.log('Updating book copy:', id, { status, condition });
      
      const updates: any = {};
      if (status) updates.status = status;
      if (condition) updates.condition = condition;
      
      const { data, error } = await supabase
        .from('book_copies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating book copy:', error);
        throw error;
      }
      
      console.log('Book copy updated successfully:', data);
      
      // Update book available_copies count
      if (status && data.book_id) {
        console.log('Updating book counts for book_id:', data.book_id);
        await updateBookAvailableCopies(data.book_id);
      }
      
      // Log the action
      createLog.mutate({
        action_type: 'book_copy_updated',
        resource_type: 'book_copy',
        resource_id: id,
        details: {
          status: status,
          condition: condition
        }
      });
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['available-book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast({
        title: 'Success',
        description: 'Book copy updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating book copy:', error);
      toast({
        title: 'Error',
        description: `Failed to update book copy: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteBookCopy = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the copy details for logging and book update
      const { data: copyData, error: fetchError } = await supabase
        .from('book_copies')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Then delete the copy
      const { error } = await supabase
        .from('book_copies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update book counts
      await updateBookAvailableCopies(copyData.book_id);
      
      // Log the action
      createLog.mutate({
        action_type: 'book_copy_deleted',
        resource_type: 'book_copy',
        resource_id: id,
        details: {
          book_id: copyData.book_id,
          tracking_code: copyData.tracking_code,
          copy_number: copyData.copy_number
        }
      });
      
      return copyData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['available-book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast({
        title: 'Success',
        description: `Book copy ${data.tracking_code} deleted successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete book copy: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Enhanced helper function to update book available copies count with better error handling
const updateBookAvailableCopies = async (bookId: string) => {
  try {
    console.log('Updating book available copies for book:', bookId);
    
    // Get accurate counts
    const { data: availableCopies, error: availableError } = await supabase
      .from('book_copies')
      .select('id')
      .eq('book_id', bookId)
      .eq('status', 'available');

    if (availableError) {
      console.error('Error fetching available copies:', availableError);
      throw availableError;
    }

    const { data: totalCopies, error: totalError } = await supabase
      .from('book_copies')
      .select('id')
      .eq('book_id', bookId);

    if (totalError) {
      console.error('Error fetching total copies:', totalError);
      throw totalError;
    }

    const availableCount = availableCopies?.length || 0;
    const totalCount = totalCopies?.length || 0;
    
    console.log(`Updating book ${bookId}: ${availableCount} available of ${totalCount} total`);

    const { error: updateError } = await supabase
      .from('books')
      .update({
        available_copies: availableCount,
        total_copies: totalCount
      })
      .eq('id', bookId);

    if (updateError) {
      console.error('Error updating book counts:', updateError);
      throw updateError;
    }
    
    console.log('Book counts updated successfully');
  } catch (error) {
    console.error('Failed to update book available copies:', error);
    throw error;
  }
};

// Completely rewritten comprehensive fix function
export const useFixAllStatusIssues = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      console.log('Starting comprehensive status fix...');
      
      let fixedCount = 0;
      
      try {
        // Step 1: Get all active borrowings with their book copy IDs
        console.log('Step 1: Getting active borrowings...');
        const { data: activeBorrowings, error: borrowingError } = await supabase
          .from('borrowings')
          .select('id, book_copy_id')
          .eq('status', 'active')
          .not('book_copy_id', 'is', null);

        if (borrowingError) {
          console.error('Error fetching active borrowings:', borrowingError);
          throw borrowingError;
        }

        const activeBorrowingCopyIds = new Set(activeBorrowings?.map(b => b.book_copy_id).filter(Boolean) || []);
        console.log('Found active borrowings for copy IDs:', Array.from(activeBorrowingCopyIds));

        // Step 2: Fix book copies that are marked as 'borrowed' but have no active borrowing
        console.log('Step 2: Fixing wrongly borrowed copies...');
        const { data: borrowedCopies, error: borrowedError } = await supabase
          .from('book_copies')
          .select('id, book_id')
          .eq('status', 'borrowed');

        if (borrowedError) {
          console.error('Error fetching borrowed copies:', borrowedError);
          throw borrowedError;
        }

        const wronglyBorrowedCopies = borrowedCopies?.filter(copy => 
          !activeBorrowingCopyIds.has(copy.id)
        ) || [];

        console.log(`Found ${wronglyBorrowedCopies.length} copies wrongly marked as borrowed`);

        for (const copy of wronglyBorrowedCopies) {
          const { error } = await supabase
            .from('book_copies')
            .update({ status: 'available' })
            .eq('id', copy.id);

          if (error) {
            console.error(`Error updating copy ${copy.id}:`, error);
          } else {
            fixedCount++;
            console.log(`Fixed copy ${copy.id}: marked as available`);
          }
        }

        // Step 3: Fix book copies that are marked as 'available' but have active borrowings
        console.log('Step 3: Fixing wrongly available copies...');
        const { data: availableCopies, error: availableError } = await supabase
          .from('book_copies')
          .select('id, book_id')
          .eq('status', 'available');

        if (availableError) {
          console.error('Error fetching available copies:', availableError);
          throw availableError;
        }

        const wronglyAvailableCopies = availableCopies?.filter(copy => 
          activeBorrowingCopyIds.has(copy.id)
        ) || [];

        console.log(`Found ${wronglyAvailableCopies.length} copies wrongly marked as available`);

        for (const copy of wronglyAvailableCopies) {
          const { error } = await supabase
            .from('book_copies')
            .update({ status: 'borrowed' })
            .eq('id', copy.id);

          if (error) {
            console.error(`Error updating copy ${copy.id}:`, error);
          } else {
            fixedCount++;
            console.log(`Fixed copy ${copy.id}: marked as borrowed`);
          }
        }

        // Step 4: Update all books' available_copies and total_copies counts
        console.log('Step 4: Updating all book counts...');
        const { data: allBooks, error: booksError } = await supabase
          .from('books')
          .select('id');

        if (booksError) {
          console.error('Error fetching books:', booksError);
          throw booksError;
        }

        console.log(`Updating counts for ${allBooks?.length || 0} books`);

        for (const book of allBooks || []) {
          try {
            await updateBookAvailableCopies(book.id);
            console.log(`Updated counts for book ${book.id}`);
          } catch (error) {
            console.error(`Error updating book ${book.id}:`, error);
          }
        }

        // Step 5: Clean up invalid borrowings (borrowings that reference non-existent copies)
        console.log('Step 5: Cleaning up invalid borrowings...');
        const { data: allCopyIds, error: copyIdsError } = await supabase
          .from('book_copies')
          .select('id');

        if (copyIdsError) {
          console.error('Error fetching copy IDs:', copyIdsError);
          throw copyIdsError;
        }

        const validCopyIds = new Set(allCopyIds?.map(c => c.id) || []);
        
        const invalidBorrowings = activeBorrowings?.filter(b => 
          b.book_copy_id && !validCopyIds.has(b.book_copy_id)
        ) || [];

        console.log(`Found ${invalidBorrowings.length} invalid borrowings to clean up`);

        for (const borrowing of invalidBorrowings) {
          const { error } = await supabase
            .from('borrowings')
            .update({
              book_copy_id: null,
              status: 'returned',
              returned_date: new Date().toISOString().split('T')[0],
              return_notes: 'Auto-corrected: Invalid book copy reference'
            })
            .eq('id', borrowing.id);

          if (error) {
            console.error(`Error fixing borrowing ${borrowing.id}:`, error);
          } else {
            fixedCount++;
            console.log(`Fixed invalid borrowing ${borrowing.id}`);
          }
        }

        console.log(`Comprehensive status fix completed. Fixed ${fixedCount} issues.`);
        
        return { 
          success: true, 
          totalFixed: fixedCount,
          wronglyBorrowedFixed: wronglyBorrowedCopies.length,
          wronglyAvailableFixed: wronglyAvailableCopies.length,
          booksUpdated: allBooks?.length || 0,
          invalidBorrowingsFixed: invalidBorrowings.length
        };

      } catch (error) {
        console.error('Error during comprehensive status fix:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['available-book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      
      toast({
        title: 'Status Fix Completed',
        description: `Successfully fixed ${data.totalFixed} status issues: ${data.wronglyBorrowedFixed} wrongly borrowed, ${data.wronglyAvailableFixed} wrongly available, ${data.invalidBorrowingsFixed} invalid borrowings, and updated ${data.booksUpdated} books.`,
      });
    },
    onError: (error) => {
      console.error('Error fixing status issues:', error);
      toast({
        title: 'Error',
        description: `Failed to fix status issues: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
