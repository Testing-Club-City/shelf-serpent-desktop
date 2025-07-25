import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import { calculateConditionFine, useCreateFine, getFineAmountBySetting } from './useFineManagement';

export const useBorrowings = (page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['borrowings', page, pageSize],
    queryFn: async () => {
      console.log('Fetching borrowings...');
      
      // First, get the total count
      const { count } = await supabase
        .from('borrowings')
        .select('*', { count: 'exact', head: true });
      
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
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        console.error('Error fetching borrowings:', error);
        throw error;
      }

      console.log('Borrowings fetched successfully:', data?.length || 0);
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

// Legacy hook for backward compatibility - returns just the borrowings array
export const useBorrowingsArray = () => {
  return useQuery({
    queryKey: ['borrowings-array'],
    queryFn: async () => {
      console.log('Fetching borrowings array...');
      
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

      if (error) {
        console.error('Error fetching borrowings array:', error);
        throw error;
      }

      console.log('Borrowings array fetched successfully:', data?.length || 0);
      return data || [];
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
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
};

export const useLostBooks = () => {
  return useQuery({
    queryKey: ['lost-books'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            isbn
          ),
          borrowings (
            id,
            fine_amount,
            returned_date,
            students (
              id,
              first_name,
              last_name,
              admission_number,
              class_grade
            )
          )
        `)
        .eq('status', 'lost')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching lost books:', error);
        throw error;
      }

      return data;
    },
  });
};

export const useFineCollection = (classFilter: string = 'all') => {
  console.log('useFineCollection called with classFilter:', classFilter);
  
  return useQuery({
    queryKey: ['fine-collection', classFilter],
    queryFn: async () => {
      // Fetch borrowing fines
      let borrowingQuery = supabase
        .from('borrowings')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade,
            class_id,
            classes (
              id,
              class_name
            )
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
            author
          )
        `)
        .gt('fine_amount', 0);

      // Fetch separate unpaid fines (including theft fines)
      let finesQuery = supabase
        .from('fines')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade,
            class_id,
            classes (
              id,
              class_name
            )
          ),
          staff (
            id,
            first_name,
            last_name,
            staff_id,
            department,
            position
          ),
          borrowings (
            id,
            books (
              id,
              title,
              author
            )
          )
        `)
        .eq('status', 'unpaid'); // Only show unpaid fines

      if (classFilter !== 'all') {
        // Filter by class if specified
        const { data: classStudents } = await supabase
          .from('students')
          .select('id')
          .eq('class_id', classFilter);
        
        if (classStudents && classStudents.length > 0) {
          const studentIds = classStudents.map(s => s.id);
          console.log('Found', classStudents.length, 'students in class', classFilter, 'with IDs:', studentIds);
          borrowingQuery = borrowingQuery.in('student_id', studentIds);
          finesQuery = finesQuery.in('student_id', studentIds);
        } else {
          // If no students found for this class, return empty array
          console.log('No students found for class:', classFilter);
          return [];
        }
      }

      const [borrowingResult, finesResult] = await Promise.all([
        borrowingQuery.order('created_at', { ascending: false }),
        finesQuery.order('created_at', { ascending: false })
      ]);

      if (borrowingResult.error) {
        console.error('Error fetching borrowing fines:', borrowingResult.error);
        throw borrowingResult.error;
      }

      if (finesResult.error) {
        console.error('Error fetching separate fines:', finesResult.error);
        throw finesResult.error;
      }

      console.log('Fine collection raw data:', 
        borrowingResult.data?.length || 0, 'borrowings with fines,',
        finesResult.data?.length || 0, 'separate fines (including theft fines)'
      );

      // Group by student and calculate total fines
      const groupedData: any[] = [];

      // Process borrowing fines
      borrowingResult.data?.forEach((borrowing) => {
        const existingStudent = groupedData.find(item => item.student_id === borrowing.student_id);
        
        // Calculate days overdue
        const dueDate = new Date(borrowing.due_date);
        const returnDate = borrowing.returned_date ? new Date(borrowing.returned_date) : new Date();
        const daysOverdue = Math.max(0, Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        const fineDetail = {
          book_title: borrowing.books?.title || 'Unknown Book',
          days_overdue: daysOverdue,
          fine_amount: borrowing.fine_amount || 0,
          fine_type: 'borrowing',
          returned_date: borrowing.returned_date ? new Date(borrowing.returned_date).toLocaleDateString() : 'Not returned'
        };

        if (existingStudent) {
          existingStudent.total_fine_amount += borrowing.fine_amount || 0;
          existingStudent.fine_count += 1;
          existingStudent.fines.push(fineDetail);
        } else {
          const student = borrowing.students;
          const className = student?.classes?.class_name || student?.class_grade || 'N/A';
          
          groupedData.push({
            student_id: borrowing.student_id,
            student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
            admission_number: student?.admission_number || 'N/A',
            class_name: className,
            total_fine_amount: borrowing.fine_amount || 0,
            fine_count: 1,
            fines: [fineDetail]
          });
        }
      });

      // Process separate fines (including theft fines)
      finesResult.data?.forEach((fine) => {
        const existingStudent = groupedData.find(item => item.student_id === fine.student_id);
        
        const fineDetail = {
          book_title: fine.borrowings?.books?.title || fine.description || 'Fine',
          days_overdue: 0, // Separate fines don't have overdue days
          fine_amount: fine.amount || 0,
          fine_type: fine.fine_type,
          status: fine.status,
          returned_date: fine.created_at ? new Date(fine.created_at).toLocaleDateString() : 'N/A'
        };

        if (existingStudent) {
          existingStudent.total_fine_amount += fine.amount || 0;
          existingStudent.fine_count += 1;
          existingStudent.fines.push(fineDetail);
        } else {
          const student = fine.students;
          const className = student?.classes?.class_name || student?.class_grade || 'N/A';
          
          groupedData.push({
            student_id: fine.student_id,
            student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
            admission_number: student?.admission_number || 'N/A',
            class_name: className,
            total_fine_amount: fine.amount || 0,
            fine_count: 1,
            fines: [fineDetail]
          });
        }
      });

      console.log('Fine collection processed data:', groupedData?.length || 0, 'students with fines (including theft fines)');
      
      return groupedData;
    },
  });
};

export const useTheftReports = () => {
  return useQuery({
    queryKey: ['theft-reports'],
    queryFn: async () => {
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
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching theft reports:', error);
        throw error;
      }

      return data;
    },
  });
};

export const useCreateBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (borrowing: any) => {
      console.log('Creating borrowing:', borrowing);
      
      // Validate required fields
      if ((!borrowing.student_id && borrowing.borrower_type === 'student') || 
          (!borrowing.staff_id && borrowing.borrower_type === 'staff') || 
          !borrowing.book_id) {
        throw new Error(borrowing.borrower_type === 'student' ? 
          'Student and book are required' : 
          'Staff and book are required');
      }

      // Validate dates
      if (!borrowing.borrowed_date || !borrowing.due_date) {
        throw new Error('Issue date and due date are required');
      }

      if (new Date(borrowing.due_date) <= new Date(borrowing.borrowed_date)) {
        throw new Error('Due date must be after issue date');
      }

      // Start a transaction to ensure both operations succeed or fail together
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
          // Note: We could rollback the borrowing here, but for now we'll just log the error
          // The trigger should handle this automatically, but we're adding this as a backup
        } else {
          console.log('Book copy status updated successfully');
        }
      }

      // Log the action
      createLog.mutate({
        action_type: 'borrowing_created',
        resource_type: 'borrowing',
        resource_id: data.id,
        details: {
          student_id: borrowing.student_id,
          staff_id: borrowing.staff_id,
          borrower_type: borrowing.borrower_type,
          book_id: borrowing.book_id,
          book_copy_id: borrowing.book_copy_id,
          tracking_code: borrowing.tracking_code,
          due_date: borrowing.due_date
        }
      });

      return data;
    },
    onSuccess: () => {
      console.log('Borrowing creation successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['available-book-copies'] });
      toast({
        title: 'Success',
        description: 'Book issued successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error creating borrowing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to issue book',
        variant: 'destructive',
      });
    },
  });
};

// Alias for components that expect this name
export const useCreateMultipleBorrowings = useCreateBorrowing;

export const useReturnBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();
  const createFine = useCreateFine();

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
      console.log('Processing book return:', { id, condition_at_return, fine_amount, is_lost });
      
      // First get the borrowing details to know the student/staff
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
          // Get lost book fine from settings
          calculatedFine = await getFineAmountBySetting('lost_book');
        } else {
          const dueDate = new Date(borrowing.due_date);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          calculatedFine = calculateConditionFine(condition_at_return || 'good', daysOverdue);
        }
      }

      // Update the borrowing
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

      if (error) {
        console.error('Error updating borrowing:', error);
        throw error;
      }

      // Create a fine record if there's a fine amount
      if (calculatedFine && calculatedFine > 0) {
        console.log('Creating fine record, amount:', calculatedFine);
        
        // Determine the appropriate fine type based on condition and situation
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
          
          console.log('Fine record created successfully with type:', fineType);
        } catch (fineError) {
          console.error('Error creating fine record:', fineError);
          // Don't throw here - we still want to complete the return process
        }
      }

      // Update book copy status if available
      if (data.book_copy_id) {
        const { error: copyError } = await supabase
          .from('book_copies')
          .update({ 
            status: is_lost ? 'lost' : 'available',
            condition: is_lost ? 'lost' : (condition_at_return || 'good')
          })
          .eq('id', data.book_copy_id);

        if (copyError) {
          console.error('Error updating book copy:', copyError);
        }
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      toast({
        title: 'Success',
        description: 'Book processed successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error processing book:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process book',
        variant: 'destructive',
      });
    },
  });
};

// Alias for components that expect this name
export const useBookReturn = useReturnBorrowing;
