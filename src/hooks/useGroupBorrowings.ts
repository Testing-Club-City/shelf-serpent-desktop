import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';

// Extended type for group borrowing with student_ids
interface GroupBorrowing {
  id: string;
  book_id: string;
  book_copy_id: string;
  tracking_code: string;
  borrowed_date: string;
  due_date: string;
  returned_date?: string;
  condition_at_issue: string;
  condition_at_return?: string;
  fine_amount?: number;
  fine_paid?: boolean;
  notes?: string;
  return_notes?: string;
  status: string;
  is_lost?: boolean;
  student_count: number;
  student_ids: string[]; // This is the column we added
  issued_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  books?: any;
  book_copies?: any;
}

export function useGroupBorrowings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: groupBorrowings,
    isLoading: groupBorrowingsLoading,
    error: groupBorrowingsError,
    refetch
  } = useQuery({
    queryKey: ['groupBorrowings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_borrowings')
        .select(`
          *,
          books:book_id (
            title,
            author,
            isbn
          )
        `)
        .order('borrowed_date', { ascending: false });

      if (error) {
        console.error('Error fetching group borrowings:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch group borrowings. Please try again.',
          variant: 'destructive',
        });
        throw error;
      }

      return data || [];
    },
  });

  const processGroupReturn = async (borrowingId: string, condition: string, notes?: string) => {
    try {
      const { error: returnError } = await supabase.rpc('process_group_return' as any, {
        p_borrowing_id: borrowingId,
        p_return_condition: condition,
        p_return_notes: notes || ''
      });

      if (returnError) throw returnError;

      // Invalidate and refetch relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['groupBorrowings'] }),
        queryClient.invalidateQueries({ queryKey: ['bookCopies'] }),
        queryClient.invalidateQueries({ queryKey: ['fines'] })
      ]);

      await refetch();

      toast({
        title: 'Success',
        description: 'Group borrowing returned successfully',
      });

      return true;
    } catch (error) {
      console.error('Error processing group return:', error);
      toast({
        title: 'Error',
        description: 'Failed to process group return. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    groupBorrowings,
    groupBorrowingsLoading,
    groupBorrowingsError,
    processGroupReturn,
  };
}

export const useCreateGroupBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLogMutation = useCreateSystemLog();

  return useMutation({
    mutationFn: async ({ 
      student_ids,
      book_id,
      book_copy_id,
      tracking_code,
      borrowed_date,
      due_date,
      condition_at_issue,
      notes
    }: any) => {
      // Create the group borrowing record
      const { data: groupBorrowing, error: groupError } = await supabase
        .from('group_borrowings')
        .insert({
          book_id,
          book_copy_id,
          tracking_code,
          borrowed_date,
          due_date,
          condition_at_issue,
          notes,
          student_ids,
          student_count: student_ids.length,
          status: 'active'
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Update the book copy status
      const { error: copyError } = await supabase
        .from('book_copies')
        .update({ status: 'borrowed' })
        .eq('id', book_copy_id);

      if (copyError) throw copyError;

      // Create system log
      try {
        await createLogMutation.mutateAsync({
          action_type: 'group_borrowing_created',
          resource_type: 'group_borrowing',
          resource_id: groupBorrowing.id,
          details: {
            student_count: student_ids.length,
            book_copy_id,
            tracking_code
          }
        });
      } catch (logError) {
        console.warn('Failed to create system log:', logError);
        // Don't fail the entire operation if logging fails
      }

      return groupBorrowing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['book_copies'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast({
        title: 'Success',
        description: 'Group borrowing created successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error creating group borrowing:', error);
      toast({
        title: 'Error',
        description: 'Failed to create group borrowing',
        variant: 'destructive',
      });
    },
  });
};

export const useReturnGroupBorrowing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLogMutation = useCreateSystemLog();

  return useMutation({
    mutationFn: async ({ 
      group_borrowing_id,
      tracking_code,
      condition_at_return,
      return_notes,
      fine_distribution_method = 'equal' // 'equal', 'first_student', or 'manual'
    }: any) => {
      // Get the group borrowing first
      const { data: groupBorrowing, error: fetchError } = await supabase
        .from('group_borrowings')
        .select('*')
        .eq('id', group_borrowing_id)
        .single();

      if (fetchError) throw fetchError;

      // Verify tracking code - Enhanced theft detection
      if (tracking_code !== groupBorrowing.tracking_code) {
        // Check if this book belongs to another borrowing (individual or group)
        const { data: otherBorrowing } = await supabase
          .from('borrowings')
          .select('*, students(*), books(*)')
          .eq('tracking_code', tracking_code)
          .eq('status', 'active')
          .single();

        const { data: otherGroupBorrowing } = await supabase
          .from('group_borrowings')
          .select('*, books(*)')
          .eq('tracking_code', tracking_code)
          .eq('status', 'active')
          .neq('id', group_borrowing_id)
          .single();

        if (otherBorrowing || otherGroupBorrowing) {
          throw new Error('THEFT_DETECTED: This book belongs to another active borrowing');
        } else {
          throw new Error('INVALID_CODE: Invalid tracking code provided');
        }
      }

      // Calculate overdue days
      const dueDate = new Date(groupBorrowing.due_date);
      const returnDate = new Date();
      const daysOverdue = Math.max(0, Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Calculate fines based on condition and overdue days
      let totalFineAmount = 0;
      let fineReasons = [];

      // Overdue fine calculation
      if (daysOverdue > 0) {
        const overdueFine = daysOverdue * 10; // KSh 10 per day overdue
        totalFineAmount += overdueFine;
        fineReasons.push(`Overdue: ${daysOverdue} days (KSh ${overdueFine})`);
      }

      // Condition-based fine calculation
      let conditionFine = 0;
      switch (condition_at_return) {
        case 'fair':
          conditionFine = 50; // Minor wear fine
          break;
        case 'poor':
          conditionFine = 150; // Significant wear fine
          break;
        case 'damaged':
          conditionFine = 300; // Damage fine
          break;
        case 'lost':
          conditionFine = 500; // Lost book replacement cost
          break;
        default:
          conditionFine = 0;
      }

      if (conditionFine > 0) {
        totalFineAmount += conditionFine;
        fineReasons.push(`Condition (${condition_at_return}): KSh ${conditionFine}`);
      }

      // Update the group borrowing with fine information
      const { error: updateError } = await supabase
        .from('group_borrowings')
        .update({
          status: 'returned',
          returned_date: new Date().toISOString(),
          condition_at_return,
          return_notes,
          fine_amount: totalFineAmount,
          fine_paid: totalFineAmount === 0 // Auto-mark as paid if no fine
        })
        .eq('id', group_borrowing_id);

      if (updateError) throw updateError;

      // Update the book copy status and condition
      const { error: copyError } = await supabase
        .from('book_copies')
        .update({ 
          status: condition_at_return === 'lost' ? 'lost' : 'available',
          condition: condition_at_return === 'lost' ? 'lost' : condition_at_return
        })
        .eq('id', groupBorrowing.book_copy_id);

      if (copyError) throw copyError;

      // Handle fines if any
      const studentIds = (groupBorrowing as any).student_ids;
      if (totalFineAmount > 0 && studentIds && studentIds.length > 0) {
        // Distribute fines among students
        const finePerStudent = Math.ceil(totalFineAmount / studentIds.length);
        
        for (const studentId of studentIds) {
          try {
            await supabase
              .from('fines')
              .insert({
                student_id: studentId,
                borrowing_id: null, // This is a group borrowing, not individual
                group_borrowing_id: group_borrowing_id,
                amount: finePerStudent,
                fine_type: daysOverdue > 0 ? 'overdue' : 'condition',
                description: `Group borrowing fine: ${fineReasons.join(', ')} (Split among ${studentIds.length} students)`,
                status: 'unpaid'
              });
          } catch (fineError) {
            console.error(`Failed to create fine for student ${studentId}:`, fineError);
          }
        }
      }

      // Create system log
      try {
        await createLogMutation.mutateAsync({
          action_type: 'group_borrowing_returned',
          resource_type: 'group_borrowing',
          resource_id: group_borrowing_id,
          details: {
            tracking_code,
            condition_at_return,
            days_overdue: daysOverdue,
            total_fine: totalFineAmount,
            fine_reasons: fineReasons,
            student_count: studentIds?.length || 0
          }
        });
      } catch (logError) {
        console.warn('Failed to create system log:', logError);
      }

      return {
        groupBorrowing,
        totalFineAmount,
        fineReasons,
        daysOverdue,
        studentsAffected: studentIds?.length || 0
      };
    },
    onSuccess: (data) => {
      // Invalidate and refetch all relevant queries
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['group_borrowings'] }),
        queryClient.invalidateQueries({ queryKey: ['book_copies'] }),
        queryClient.invalidateQueries({ queryKey: ['fines'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        // Force an immediate refetch of group borrowings
        queryClient.fetchQuery({ queryKey: ['group_borrowings'] })
      ]);
      
      let message = 'Group borrowing returned successfully';
      
      if (data.totalFineAmount > 0) {
        message += `. Total fine: KSh ${data.totalFineAmount} (split among ${data.studentsAffected} students)`;
      }
      
      if (data.daysOverdue > 0) {
        message += `. Book was ${data.daysOverdue} days overdue.`;
      }
      
      toast({
        title: 'Group Return Processed',
        description: message,
        duration: data.totalFineAmount > 0 ? 8000 : 4000,
      });
    },
    onError: (error: any) => {
      console.error('Error returning group borrowing:', error);
      let title = 'Group Return Failed';
      let description = 'Failed to process group return';
      
      if (error.message.includes('THEFT_DETECTED')) {
        title = '🚨 THEFT ALERT';
        description = 'This book belongs to another active borrowing! Potential theft detected.';
      } else if (error.message.includes('INVALID_CODE')) {
        title = 'Invalid Tracking Code';
        description = 'The tracking code provided does not match any active borrowing.';
      }
      
      toast({
        title,
        description,
        variant: 'destructive',
        duration: 6000,
      });
    },
  });
};