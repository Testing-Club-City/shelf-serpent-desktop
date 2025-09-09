import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import { calculateConditionFine, useCreateFine, getFineAmountBySetting } from './useFineManagement';
import { OfflineDataService } from '@/services/offlineDataService';

// Connection status hook
const useConnectionStatus = () => {
  return useQuery({
    queryKey: ['connection-status'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('books').select('id').limit(1);
        return !error;
      } catch {
        return false;
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false,
  });
};

// Offline-first borrowings hook
export const useOfflineBorrowings = (page: number = 1, pageSize: number = 50) => {
  const { data: isOnline } = useConnectionStatus();

  return useQuery({
    queryKey: ['offline-borrowings', page, pageSize, isOnline],
    queryFn: async () => {
      console.log('Fetching borrowings...', isOnline ? 'ONLINE' : 'OFFLINE');
      
      if (isOnline) {
        // Online: Use Supabase
        try {
          const { count } = await supabase
            .from('borrowings')
            .select('*', { count: 'exact', head: true });
          
          const { data, error } = await supabase
            .from('borrowings')
            .select(`
              *,
              students (
                id,
                first_name,
                last_name,
                admission_number,
                class_grade
              ),
              staff (
                id,
                first_name,
                last_name,
                staff_id,
                department,
                position
              ),
              books (
                id,
                title,
                author,
                book_code
              ),
              book_copies (
                id,
                copy_number,
                tracking_code,
                condition,
                status
              )
            `)
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1);

          if (error) throw error;

          return {
            data: data || [],
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
            currentPage: page,
            pageSize,
            source: 'online'
          };
        } catch (error) {
          console.warn('Online fetch failed, falling back to offline:', error);
          // Fall through to offline mode
        }
      }
      
      // Offline: Use local SQLite database
      try {
        const borrowings = await OfflineDataService.getBorrowings();
        
        // Apply pagination locally
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = borrowings.slice(startIndex, endIndex);
        
        return {
          data: paginatedData,
          totalCount: borrowings.length,
          totalPages: Math.ceil(borrowings.length / pageSize),
          currentPage: page,
          pageSize,
          source: 'offline'
        };
      } catch (error) {
        console.error('Error fetching offline borrowings:', error);
        throw error;
      }
    },
  });
};

// Offline-first borrowings array hook (for backward compatibility)
export const useOfflineBorrowingsArray = () => {
  const { data: isOnline } = useConnectionStatus();

  return useQuery({
    queryKey: ['offline-borrowings-array', isOnline],
    queryFn: async () => {
      console.log('Fetching borrowings array...', isOnline ? 'ONLINE' : 'OFFLINE');
      
      if (isOnline) {
        // Online: Use Supabase
        try {
          const { data, error } = await supabase
            .from('borrowings')
            .select(`
              *,
              students (
                id,
                first_name,
                last_name,
                admission_number,
                class_grade
              ),
              staff (
                id,
                first_name,
                last_name,
                staff_id,
                department,
                position
              ),
              books (
                id,
                title,
                author,
                book_code
              ),
              book_copies (
                id,
                copy_number,
                tracking_code,
                condition,
                status
              )
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        } catch (error) {
          console.warn('Online fetch failed, falling back to offline:', error);
          // Fall through to offline mode
        }
      }
      
      // Offline: Use local SQLite database
      try {
        return await OfflineDataService.getBorrowings();
      } catch (error) {
        console.error('Error fetching offline borrowings:', error);
        throw error;
      }
    },
  });
};

// Offline-first book return hook
export const useOfflineBookReturn = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();
  const createFine = useCreateFine();
  const { data: isOnline } = useConnectionStatus();

  return useMutation({
    mutationFn: async ({ 
      id, 
      condition_at_return, 
      fine_amount, 
      notes, 
      is_lost = false,
      returned_tracking_code,
      prevent_auto_fine = false,
      is_group_return = false,
      group_id = null
    }: any) => {
      console.log('Processing book return...', isOnline ? 'ONLINE' : 'OFFLINE');
      
      if (isOnline) {
        // Online: Use Supabase (existing logic)
        try {
          // First get the borrowing details
          const { data: borrowing } = await supabase
            .from('borrowings')
            .select(`
              *,
              students (id, first_name, last_name, admission_number, class_grade),
              staff (id, first_name, last_name, staff_id, department, position),
              books (id, title, author, book_code),
              book_copies (id, copy_number, tracking_code, condition, status)
            `)
            .eq('id', id)
            .single();

          if (!borrowing) {
            throw new Error('Borrowing not found');
          }

          // Calculate fine if needed
          let calculatedFine = fine_amount;
          if (!prevent_auto_fine && (fine_amount === undefined || fine_amount === null)) {
            if (is_lost) {
              calculatedFine = await getFineAmountBySetting('lost_book');
            } else {
              const dueDate = new Date(borrowing.due_date);
              const today = new Date();
              const daysOverdue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
              calculatedFine = calculateConditionFine(condition_at_return || 'good', daysOverdue);
            }
          }

          // Update the borrowing in Supabase
          const { data, error } = await supabase
            .from('borrowings')
            .update({
              status: is_lost ? 'active' : 'returned',
              returned_date: is_lost ? null : new Date().toISOString().split('T')[0],
              condition_at_return,
              fine_amount: calculatedFine || 0,
              return_notes: notes,
              is_lost: is_lost
            })
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          // Create fine record if needed
          if (calculatedFine && calculatedFine > 0) {
            let fineType = 'overdue';
            
            if (is_lost) {
              fineType = 'lost_book';
            } else if (condition_at_return === 'damaged') {
              fineType = 'damaged';
            } else if (condition_at_return === 'poor') {
              fineType = 'poor_condition';
            } else if (condition_at_return === 'fair') {
              fineType = 'fair_condition';
            } else if (new Date(borrowing.due_date) < new Date()) {
              fineType = 'late_return';
            }
            
            const fineDescription = `Fine for ${borrowing.books.title}: ${condition_at_return || 'overdue'} condition`;
            
            try {
              await createFine.mutateAsync({
                studentId: borrowing.student_id,
                staffId: borrowing.staff_id,
                borrowingId: borrowing.id,
                amount: calculatedFine,
                fineType: fineType,
                description: fineDescription,
                preventDuplicates: true
              });
            } catch (fineError) {
              console.error('Error creating fine record:', fineError);
            }
          }

          // Update book copy status
          if (data.book_copy_id) {
            await supabase
              .from('book_copies')
              .update({ 
                status: is_lost ? 'lost' : 'available',
                condition: is_lost ? 'lost' : (condition_at_return || 'good')
              })
              .eq('id', data.book_copy_id);
          }

          return data;
        } catch (error) {
          console.warn('Online return failed, falling back to offline:', error);
          // Fall through to offline mode
        }
      }
      
      // Offline: Use local SQLite database
      try {
        const returnData = {
          returned_date: is_lost ? null : new Date().toISOString().split('T')[0],
          status: is_lost ? 'active' : 'returned',
          condition_at_return,
          fine_amount: fine_amount || 0,
          return_notes: notes,
          is_lost: is_lost
        };

        await OfflineDataService.returnBook(id, returnData);
        
        toast({
          title: "Book Return Processed (Offline)",
          description: "Book return saved locally. Will sync when online.",
        });

        return { id, ...returnData };
      } catch (error) {
        console.error('Error processing offline return:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate both online and offline queries
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['offline-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['offline-borrowings-array'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings-array'] });
      
      toast({
        title: "Book Returned Successfully",
        description: "The book has been returned and processed.",
      });
    },
    onError: (error: any) => {
      console.error('Book return error:', error);
      toast({
        title: "Return Failed",
        description: error.message || "Failed to process book return",
        variant: "destructive",
      });
    },
  });
};

// Export aliases for backward compatibility
export const useBorrowings = useOfflineBorrowings;
export const useBorrowingsArray = useOfflineBorrowingsArray;
export const useBookReturn = useOfflineBookReturn;
export const useReturnBorrowing = useOfflineBookReturn;
