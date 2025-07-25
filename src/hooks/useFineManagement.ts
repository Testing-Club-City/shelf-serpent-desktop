import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from './useSystemLogs';
import { useState } from 'react';

export const useFines = () => {
  return useQuery({
    queryKey: ['fines'],
    queryFn: async () => {
      console.log('Fetching all fines including theft fines...');
      const { data, error } = await supabase
        .from('fines')
        .select(`
          *,
          students:student_id (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade
          ),
          staff:staff_id (
            id,
            staff_id,
            first_name,
            last_name,
            email,
            department,
            position
          ),
          borrowings (
            id,
            book_id,
            student_id,
            staff_id,
            books (
              title,
              author
            ),
            students (
              id,
              first_name,
              last_name,
              admission_number,
              class_grade
            ),
            staff (
              id,
              staff_id,
              first_name,
              last_name,
              email,
              department,
              position
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching fines:', error);
        throw error;
      }

      // Log breakdown of fine types for debugging
      if (data) {
        const fineTypes = data.reduce((acc: Record<string, number>, fine: any) => {
          acc[fine.fine_type] = (acc[fine.fine_type] || 0) + 1;
          return acc;
        }, {});
        
        const statusTypes = data.reduce((acc: Record<string, number>, fine: any) => {
          acc[fine.status] = (acc[fine.status] || 0) + 1;
          return acc;
        }, {});
        
        const staffFines = data.filter((f: any) => f.staff_id);
        const studentFines = data.filter((f: any) => f.student_id);
        
        console.log('Fines breakdown by type:', fineTypes);
        console.log('Fines breakdown by status:', statusTypes);
        console.log('Total fines fetched:', data.length);
        console.log('Staff fines:', staffFines.length);
        console.log('Student fines:', studentFines.length);
        console.log('Sample staff fine:', staffFines[0]);
        console.log('Unpaid fines:', data.filter((f: any) => f.status === 'unpaid').length);
        console.log('Theft fines (stolen_book):', data.filter((f: any) => f.fine_type === 'stolen_book').length);
        
        // Log each unpaid fine for debugging
        const unpaidFines = data.filter((f: any) => f.status === 'unpaid');
        unpaidFines.forEach((fine: any, index: number) => {
          console.log(`Unpaid fine ${index + 1}:`, {
            id: fine.id,
            student: fine.students ? `${fine.students.first_name} ${fine.students.last_name}` : 'Unknown',
            type: fine.fine_type,
            amount: fine.amount,
            status: fine.status,
            created: fine.created_at,
            borrowing_id: fine.borrowing_id
          });
        });
      }

      console.log('Fines fetched successfully:', data);
      return data;
    },
    // Refresh every 15 seconds to catch new fines
    refetchInterval: 15000,
    // Consider data fresh for 10 seconds
    staleTime: 10000,
    // Retry failed requests
    retry: 3,
  });
};

// Get fine settings from admin configuration
export const useFineSettings = () => {
  return useQuery({
    queryKey: ['fine-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fine_settings')
        .select('*')
        .order('fine_type');

      if (error) {
        console.error('Error fetching fine settings:', error);
        throw error;
      }

      return data;
    },
  });
};

// Calculate condition-based fine amounts
export const calculateConditionFine = (condition: string, daysOverdue: number = 0) => {
  const baseFine = daysOverdue * 10; // KSh 10 per day overdue
  
  let conditionFine = 0;
  switch (condition) {
    case 'excellent':
    case 'good':
      conditionFine = 0;
      break;
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
  
  return baseFine + conditionFine;
};

// Get fine amount from settings or use default
export const getFineAmountBySetting = async (fineType: string) => {
  const { data: settings } = await supabase
    .from('fine_settings')
    .select('amount')
    .eq('fine_type', fineType)
    .maybeSingle();

  const defaultAmounts: Record<string, number> = {
    overdue: 10,
    damaged: 300,
    lost_book: 500,
    stolen_book: 800,
    theft_victim: 0, // No fine for victim
    condition: 50
  };

  return settings?.amount || defaultAmounts[fineType] || 0;
};

// Detect and handle theft automatically
export const useDetectTheft = () => {
  const { toast } = useToast();
  const [lastCheckedCode, setLastCheckedCode] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const THROTTLE_TIME = 1000; // 1 second throttle

  return useMutation({
    mutationFn: async ({ returnedTrackingCode, expectedBorrowings, studentId }: {
      returnedTrackingCode: string;
      expectedBorrowings: any[];
      studentId?: string;
    }) => {
      // Throttle checks for the same code
      const now = Date.now();
      if (
        returnedTrackingCode === lastCheckedCode && 
        now - lastCheckTime < THROTTLE_TIME
      ) {
        console.log('Throttling check for:', returnedTrackingCode);
        throw new Error('Throttled');
      }
      
      setLastCheckedCode(returnedTrackingCode);
      setLastCheckTime(now);
      
      console.log('Verifying book code:', returnedTrackingCode);
      
      // Check if the returned book matches any expected borrowing for this student
      const expectedBorrowing = expectedBorrowings.find(b => 
        b.tracking_code?.toLowerCase() === returnedTrackingCode.toLowerCase()
      );

      if (expectedBorrowing) {
        return { isTheft: false, expectedBorrowing, victimBorrowing: null };
      }

      // If student ID is provided, check if this specific book belongs to another student
      if (studentId) {
        // Directly query for this specific tracking code
        const { data: victimBorrowing } = await supabase
          .from('borrowings')
          .select(`
            *,
            students (id, first_name, last_name, admission_number),
            books (id, title, author)
          `)
          .eq('tracking_code', returnedTrackingCode)
          .eq('status', 'active')
          .not('student_id', 'eq', studentId)
          .maybeSingle();

        if (victimBorrowing) {
          console.log('Book belongs to another student:', victimBorrowing.students);
          
          // Get theft fine amounts from settings
          const stolenBookFine = await getFineAmountBySetting('stolen_book');
          
          return {
            isTheft: true,
            expectedBorrowing: null,
            victimBorrowing,
            stolenBookFine
          };
        }
      }

      // If no match found, just return no match
      return { isTheft: false, expectedBorrowing: null, victimBorrowing: null };
    },
    onError: (error) => {
      if (error.message === 'Throttled') {
        // Silently ignore throttled requests
        return;
      }
      
      console.error('Error verifying book:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify book',
        variant: 'destructive',
      });
    },
  });
};

// Handle found lost book
export const useHandleFoundLostBook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ trackingCode, foundByStudentId }: {
      trackingCode: string;
      foundByStudentId: string;
    }) => {
      console.log('Handling found lost book:', trackingCode);

      // Find the borrowing that was marked as lost
      const { data: lostBorrowing } = await supabase
        .from('borrowings')
        .select(`
          *,
          students (id, first_name, last_name, admission_number),
          books (id, title, author)
        `)
        .eq('tracking_code', trackingCode)
        .eq('is_lost', true)
        .maybeSingle();

      if (!lostBorrowing) {
        throw new Error('No lost book found with this tracking code');
      }

      // Update the borrowing to mark it as found
      const { error: updateError } = await supabase
        .from('borrowings')
        .update({
          is_lost: false,
          return_notes: `Book found and returned. Originally reported as lost.`,
          status: 'returned',
          returned_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', lostBorrowing.id);

      if (updateError) throw updateError;

      // Update book copy status back to available
      if (lostBorrowing.book_copy_id) {
        await supabase
          .from('book_copies')
          .update({ status: 'available', condition: 'good' })
          .eq('id', lostBorrowing.book_copy_id);
      }

      // Clear any existing lost book fines for the original student
      await supabase
        .from('fines')
        .update({ status: 'cleared', updated_at: new Date().toISOString() })
        .eq('borrowing_id', lostBorrowing.id)
        .eq('fine_type', 'lost_book');

      // Create notification for librarian
      await supabase
        .from('notifications')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // System notification
          title: 'Lost Book Found',
          message: `Lost book "${lostBorrowing.books.title}" (${trackingCode}) has been found and returned. Original student ${lostBorrowing.students.first_name} ${lostBorrowing.students.last_name} fines have been cleared.`,
          type: 'info',
          related_id: lostBorrowing.id
        });

      // Log the activity
      await logActivity(
        'lost_book_found',
        'borrowing',
        lostBorrowing.id,
        {
          tracking_code: trackingCode,
          original_student_id: lostBorrowing.student_id,
          found_by_student_id: foundByStudentId,
          book_title: lostBorrowing.books.title
        }
      );

      return {
        lostBorrowing,
        message: `Book "${lostBorrowing.books.title}" was previously reported as lost by ${lostBorrowing.students.first_name} ${lostBorrowing.students.last_name}. Their fines have been cleared.`
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      
      toast({
        title: 'Lost Book Found!',
        description: data.message,
        duration: 6000,
      });
    },
    onError: (error) => {
      console.error('Error handling found lost book:', error);
      toast({
        title: 'Error',
        description: `Failed to process found book: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Check if a fine already exists for a borrowing
export const useCheckExistingFine = () => {
  return useMutation({
    mutationFn: async ({ borrowingId, fineType }: { borrowingId: string; fineType: string }) => {
      const { data, error } = await supabase
        .from('fines')
        .select('id, amount, status')
        .eq('borrowing_id', borrowingId)
        .eq('fine_type', fineType)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
};

// Create fine with duplicate prevention
export const useCreateFine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      studentId, 
      staffId,
      borrowingId, 
      amount, 
      fineType, 
      description,
      preventDuplicates = true 
    }: {
      studentId?: string;
      staffId?: string;
      borrowingId: string;
      amount: number;
      fineType: string;
      description: string;
      preventDuplicates?: boolean;
    }) => {
      console.log('Creating fine:', { studentId, staffId, borrowingId, amount, fineType });

      if (!studentId && !staffId) {
        throw new Error('Either studentId or staffId must be provided');
      }

      // Check for existing fine if duplicate prevention is enabled
      if (preventDuplicates) {
        const { data: existingFine } = await supabase
          .from('fines')
          .select('id, amount, status')
          .eq('borrowing_id', borrowingId)
          .eq('fine_type', fineType)
          .maybeSingle();

        if (existingFine) {
          console.log('Fine already exists for this borrowing and type:', existingFine);
          return existingFine;
        }
      }

      const { data, error } = await supabase
        .from('fines')
        .insert({
          student_id: studentId || null,
          staff_id: staffId || null,
          borrowing_id: borrowingId,
          amount: amount,
          fine_type: fineType,
          description: description,
          status: 'unpaid'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating fine:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'fine_created',
        'fine',
        data.id,
        {
          fine_amount: amount,
          student_id: studentId,
          staff_id: staffId,
          borrowing_id: borrowingId,
          fine_type: fineType,
          description: description
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['fine-collection'] });
      toast({
        title: 'Success',
        description: 'Fine created successfully',
      });
    },
    onError: (error) => {
      console.error('Error creating fine:', error);
      toast({
        title: 'Error',
        description: `Failed to create fine: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const usePayFine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fineId: string) => {
      console.log('Paying fine:', fineId);
      
      const { data, error } = await supabase
        .from('fines')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', fineId)
        .select()
        .single();

      if (error) {
        console.error('Error paying fine:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'fine_paid',
        'fine',
        fineId,
        {
          fine_amount: data.amount,
          student_id: data.student_id,
          description: 'Fine payment processed'
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['fine-collection'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      toast({
        title: 'Success',
        description: 'Fine paid successfully',
      });
    },
    onError: (error) => {
      console.error('Error paying fine:', error);
      toast({
        title: 'Error',
        description: `Failed to pay fine: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useClearFine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fineId: string) => {
      console.log('Clearing fine:', fineId);
      
      const { data, error } = await supabase
        .from('fines')
        .update({
          status: 'cleared',
          updated_at: new Date().toISOString()
        })
        .eq('id', fineId)
        .select()
        .single();

      if (error) {
        console.error('Error clearing fine:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'fine_cleared',
        'fine',
        fineId,
        {
          fine_amount: data.amount,
          student_id: data.student_id,
          description: 'Fine cleared by administrator'
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['fine-collection'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      toast({
        title: 'Success',
        description: 'Fine cleared successfully',
      });
    },
    onError: (error) => {
      console.error('Error clearing fine:', error);
      toast({
        title: 'Error',
        description: `Failed to clear fine: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useCollectFine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ fineId, amountCollected }: { fineId: string; amountCollected: number }) => {
      console.log('Collecting fine:', fineId, 'Amount:', amountCollected);
      
      const { data, error } = await supabase
        .from('fines')
        .update({
          status: 'collected',
          amount: amountCollected,
          updated_at: new Date().toISOString()
        })
        .eq('id', fineId)
        .select()
        .single();

      if (error) {
        console.error('Error collecting fine:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'fine_collected',
        'fine',
        fineId,
        {
          fine_amount: amountCollected,
          student_id: data.student_id,
          description: `Fine collection: KSh ${amountCollected}`
        }
      );

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['fine-collection'] });
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      toast({
        title: 'Success',
        description: `Fine of KSh ${variables.amountCollected} collected successfully`,
      });
    },
    onError: (error) => {
      console.error('Error collecting fine:', error);
      toast({
        title: 'Error',
        description: `Failed to collect fine: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Helper function to get fine type description
export const getFineTypeDescription = (fine: any) => {
  // Handle different fine type variations
  const fineType = fine.fine_type?.toLowerCase();
  
  switch (fineType) {
    case 'overdue':
      return 'Overdue Fine';
    case 'damaged':
    case 'damage':
      return 'Book Damage Fine';
    case 'lost':
    case 'lost_book':
      return 'Lost Book Fine';
    case 'stolen':
    case 'stolen_book':
    case 'theft':
      return 'Book Theft Fine';
    case 'fair':
    case 'fair_condition':
      return 'Fair Condition Fine';
    case 'poor':
    case 'poor_condition':
      return 'Poor Condition Fine';
    case 'condition':
      return 'Condition Fine';
    case 'late_return':
      return 'Late Return Fine';
    case 'replacement':
      return 'Book Replacement Fine';
    case 'processing':
      return 'Processing Fee';
    default:
      // Fallback: capitalize and replace underscores
      if (fine.fine_type) {
        return fine.fine_type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') + ' Fine';
      }
      return 'Library Fine';
  }
};
