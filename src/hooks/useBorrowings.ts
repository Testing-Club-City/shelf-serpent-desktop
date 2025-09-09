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

export const useBorrowings = (page: number = 1, pageSize: number = 50) => {
  const { data: isOnline } = useConnectionStatus();

  return useQuery({
    queryKey: ['borrowings', page, pageSize, isOnline],
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

          console.log('Borrowings fetched successfully (ONLINE):', data?.length || 0);
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
        
        console.log('Borrowings fetched successfully (OFFLINE):', paginatedData.length);
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

// Legacy hook for backward compatibility - returns just the borrowings array
export const useBorrowingsArray = () => {
  const { data: isOnline } = useConnectionStatus();

  return useQuery({
    queryKey: ['borrowings-array', isOnline],
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
          console.log('Borrowings array fetched successfully (ONLINE):', data?.length || 0);
          return data || [];
        } catch (error) {
          console.warn('Online fetch failed, falling back to offline:', error);
          // Fall through to offline mode
        }
      }
      
      // Offline: Use local SQLite database
      try {
        const borrowings = await OfflineDataService.getBorrowings();
        console.log('Borrowings array fetched successfully (OFFLINE):', borrowings.length);
        return borrowings;
      } catch (error) {
        console.error('Error fetching offline borrowings:', error);
        throw error;
      }
    },
  });
};

export const useOverdueBorrowings = (page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['overdue-borrowings', page, pageSize],
    queryFn: async () => {
      console.log('Fetching overdue borrowings...');
      const today = new Date().toISOString().split('T')[0];
      
      // First, get the total count
      const { count } = await supabase
        .from('borrowings')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .eq('status', 'active');
      
      // Then get the paginated data
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
        .lt('due_date', today)
        .eq('status', 'active')
        .order('due_date', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        console.error('Error fetching overdue borrowings:', error);
        throw error;
      }

      console.log('Overdue borrowings fetched successfully:', data?.length || 0);
      return {
        data: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
        pageSize
      };
    },
  });
};

export const useBorrowingsByStudent = (studentId: string) => {
  return useQuery({
    queryKey: ['borrowings-by-student', studentId],
    queryFn: async () => {
      console.log('Fetching borrowings for student:', studentId);
      
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          *,
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
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching borrowings by student:', error);
        throw error;
      }

      console.log('Student borrowings fetched successfully:', data?.length || 0);
      return data || [];
    },
    enabled: !!studentId,
  });
};

export const useBorrowingsByStaff = (staffId: string) => {
  return useQuery({
    queryKey: ['borrowings-by-staff', staffId],
    queryFn: async () => {
      console.log('Fetching borrowings for staff:', staffId);
      
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          *,
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
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching borrowings by staff:', error);
        throw error;
      }

      console.log('Staff borrowings fetched successfully:', data?.length || 0);
      return data || [];
    },
    enabled: !!staffId,
  });
};

export const useCreateBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (borrowing: any) => {
      console.log('Creating borrowing:', borrowing);
      
      const { data, error } = await supabase
        .from('borrowings')
        .insert([{
          student_id: borrowing.student_id,
          staff_id: borrowing.staff_id,
          borrower_type: borrowing.borrower_type || 'student',
          book_id: borrowing.book_id,
          book_copy_id: borrowing.book_copy_id || null,
          tracking_code: borrowing.tracking_code || null,
          borrowed_date: borrowing.borrowed_date,
          due_date: borrowing.due_date,
          condition_at_issue: borrowing.condition_at_issue || 'good',
          notes: borrowing.notes || null,
          status: 'active'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating borrowing:', error);
        throw new Error(`Failed to create borrowing: ${error.message}`);
      }

      console.log('Borrowing created successfully:', data);

      // Update the book copy status to 'borrowed' if book_copy_id is provided
      if (borrowing.book_copy_id) {
        console.log('Updating book copy status to borrowed for copy:', borrowing.book_copy_id);
        
        const { error: updateError } = await supabase
          .from('book_copies')
          .update({ status: 'borrowed' })
          .eq('id', borrowing.book_copy_id);

        if (updateError) {
          console.error('Error updating book copy status:', updateError);
        } else {
          console.log('Book copy status updated successfully');
        }
      }

      // Log the action
      createLog.mutate({
        action_type: 'book_borrowed',
        resource_type: 'borrowing',
        resource_id: data.id,
        details: {
          book_id: borrowing.book_id,
          student_id: borrowing.student_id,
          staff_id: borrowing.staff_id,
          due_date: borrowing.due_date
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      toast({
        title: 'Success',
        description: 'Book borrowed successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error creating borrowing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create borrowing',
        variant: 'destructive',
      });
    },
  });
};

// Alias for backward compatibility
export const useCreateMultipleBorrowings = useCreateBorrowing;

export const useReturnBorrowing = () => {
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

          // Log the action
          createLog.mutate({
            action_type: is_lost ? 'book_marked_lost' : 'book_returned',
            resource_type: 'borrowing',
            resource_id: data.id,
            details: {
              condition: condition_at_return,
              fine_amount: calculatedFine,
              is_lost: is_lost,
              notes: notes
            }
          });

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
        
        console.log('Book return processed offline:', { id, returnData });
        
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
      queryClient.invalidateQueries({ queryKey: ['borrowings-array'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      
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

// Alias for components that expect this name
export const useBookReturn = useReturnBorrowing;

// Fine collection hook (alias for useFines)
export const useFineCollection = () => {
  return useQuery({
    queryKey: ['fine-collection'],
    queryFn: async () => {
      console.log('Fetching fine collection...');
      
      const { data, error } = await supabase
        .from('fines')
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
            department
          ),
          borrowings (
            id,
            borrowed_date,
            due_date,
            returned_date,
            books (
              id,
              title,
              author
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching fine collection:', error);
        throw error;
      }

      console.log('Fine collection fetched successfully:', data?.length || 0);
      return data || [];
    },
  });
};

// Theft reports hook
export const useTheftReports = () => {
  return useQuery({
    queryKey: ['theft-reports'],
    queryFn: async () => {
      console.log('Fetching theft reports...');
      
      const { data, error } = await supabase
        .from('theft_reports')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade
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
            tracking_code
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching theft reports:', error);
        throw error;
      }

      console.log('Theft reports fetched successfully:', data?.length || 0);
      return data || [];
    },
  });
};
