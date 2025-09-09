
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useLostBooks = () => {
  return useQuery({
    queryKey: ['lost-books'],
    queryFn: async () => {
      console.log('Fetching lost books...');
      
      // Fetch all borrowings that are marked as lost (is_lost = true) with proper joins
      const { data: lostBorrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select(`
          *,
          students!inner (
            id, first_name, last_name, admission_number, class_grade
          ),
          books!inner (
            id, title, author, isbn, book_code
          ),
          book_copies (
            id, tracking_code, copy_number, condition, status
          )
        `)
        .eq('is_lost', true)
        .order('updated_at', { ascending: false });

      if (borrowingsError) {
        console.error('Error fetching lost borrowings:', borrowingsError);
        throw borrowingsError;
      }

      console.log('Lost borrowings fetched:', lostBorrowings?.length || 0, lostBorrowings);

      // Also fetch book copies that are marked as lost but might not have borrowing records
      const { data: lostCopies, error: copiesError } = await supabase
        .from('book_copies')
        .select(`
          *,
          books!inner (
            id, title, author, isbn, book_code
          )
        `)
        .eq('status', 'lost')
        .order('updated_at', { ascending: false });

      if (copiesError) {
        console.error('Error fetching lost book copies:', copiesError);
      }

      console.log('Lost copies fetched:', lostCopies?.length || 0, lostCopies);

      const allLostBooks = [];
      const seenCopyIds = new Set();

      // Add lost borrowings first (these have student associations)
      if (lostBorrowings?.length > 0) {
        for (const borrowing of lostBorrowings) {
          allLostBooks.push({
            id: borrowing.book_copy_id || borrowing.id,
            borrowing_id: borrowing.id,
            tracking_code: borrowing.tracking_code || borrowing.book_copies?.tracking_code || 'N/A',
            copy_number: borrowing.book_copies?.copy_number || 1,
            status: 'lost',
            condition: 'lost',
            books: borrowing.books,
            students: borrowing.students, // This should now have the proper student data
            borrowing: borrowing,
            fine_amount: borrowing.fine_amount || 1500, // Default to 1500 if not set
            lost_date: borrowing.updated_at,
            type: 'lost_borrowing'
          });
          
          // Keep track of copy IDs we've already added
          if (borrowing.book_copy_id) {
            seenCopyIds.add(borrowing.book_copy_id);
          }
        }
      }

      // Add lost copies that aren't already included from borrowings
      if (lostCopies?.length > 0) {
        for (const copy of lostCopies) {
          if (!seenCopyIds.has(copy.id)) {
            allLostBooks.push({
              id: copy.id,
              borrowing_id: null,
              tracking_code: copy.tracking_code || 'N/A',
              copy_number: copy.copy_number || 1,
              status: 'lost',
              condition: 'lost',
              books: copy.books,
              students: null, // No student info for direct copy losses
              borrowing: null,
              fine_amount: 1500, // Default replacement cost
              lost_date: copy.updated_at,
              type: 'lost_copy'
            });
          }
        }
      }

      console.log('Final lost books data:', allLostBooks.length, allLostBooks);
      return allLostBooks;
    },
  });
};
