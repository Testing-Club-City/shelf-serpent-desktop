import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  RotateCcw, 
  AlertTriangle, 
  FileText, 
  Users,
  Plus,
  Search,
  Activity,
  Clock,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  X,
  Currency,
  BookX,
  Pencil,
  Eye,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  ArrowRight,
  Printer,
  Scan,
  ShieldAlert,
  UsersRound,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  BarChart3
} from 'lucide-react';
import FineCollectionReceiptDialog from './FineCollectionReceiptDialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { NewBorrowingForm } from './NewBorrowingForm';
import { BookReturnForm } from './BookReturnForm';
import { DirectReturnForm } from './DirectReturnForm';
import { useBorrowings, useOverdueBorrowings, useFineCollection, useReturnBorrowing, useCreateBorrowing, useTheftReports } from '@/hooks/useBorrowings';
import { useBorrowingsOffline } from '@/hooks/useBorrowingsOffline';
import { useFines, usePayFine, useClearFine, useCollectFine, getFineAmountBySetting, getFineTypeDescription } from '@/hooks/useFineManagement';
import { format, differenceInDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentMetaContext } from '@/hooks/useDocumentMetaContext';
import { GroupBorrowingForm } from './GroupBorrowingForm';
import { GroupReturnForm } from './GroupReturnForm';
import { useGroupBorrowings, useCreateGroupBorrowing, useReturnGroupBorrowing } from '@/hooks/useGroupBorrowings';
import { useClassesOffline } from '@/hooks/useClassesOffline';
import { useStudents } from '@/hooks/useStudents';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { logActivity } from '@/hooks/useSystemLogs';

interface BorrowingManagementProps {
  initialTab?: string;
}

// Helper function to identify group borrowings
const isGroupBorrowing = (borrowing: any) => {
  return borrowing?.notes?.includes('Group borrowing with') || false;
};

// Helper function to extract group information
const getGroupInfo = (borrowing: any) => {
  if (!isGroupBorrowing(borrowing)) return null;
  
  const notesText = borrowing.notes || '';
  const studentCountMatch = notesText.match(/Group borrowing with (\d+) students/);
  const groupIdMatch = notesText.match(/Group ID: ([0-9a-f-]+)/);
  
  return {
    studentCount: studentCountMatch ? parseInt(studentCountMatch[1]) : 0,
    groupId: groupIdMatch ? groupIdMatch[1] : null
  };
};

// Helper function to get borrower details
const getBorrowerDetails = (fine: any) => {
  // Check if this is a student fine
  if (fine.student_id) {
    if (fine.students) {
      return {
        name: `${fine.students.first_name} ${fine.students.last_name}`,
        id: fine.students.admission_number || fine.students.id,
        type: 'Student',
        class: fine.students.class_grade || 'N/A'
      };
    } else {
      // Fallback: try to get student info from borrowing if available
      const borrowingStudents = fine.borrowings?.students;
      if (borrowingStudents) {
        return {
          name: `${borrowingStudents.first_name} ${borrowingStudents.last_name}`,
          id: borrowingStudents.admission_number || borrowingStudents.id,
          type: 'Student',
          class: borrowingStudents.class_grade || 'N/A'
        };
      }
      return {
        name: 'Unknown Student',
        id: fine.student_id.slice(-8), // Show last 8 chars of ID
        type: 'Student',
        class: 'N/A'
      };
    }
  }
  
  // Check if this is a staff fine
  if (fine.staff_id) {
    if (fine.staff) {
      return {
        name: `${fine.staff.first_name} ${fine.staff.last_name}`,
        id: fine.staff.staff_id || fine.staff.email,
        type: 'Staff',
        class: fine.staff.department || fine.staff.position || 'N/A'
      };
    } else {
      // Fallback: try to get staff info from borrowing if available
      const borrowingStaff = fine.borrowings?.staff;
      if (borrowingStaff) {
        return {
          name: `${borrowingStaff.first_name} ${borrowingStaff.last_name}`,
          id: borrowingStaff.staff_id || borrowingStaff.email,
          type: 'Staff',
          class: borrowingStaff.department || borrowingStaff.position || 'N/A'
        };
      }
      return {
        name: 'Unknown Staff',
        id: fine.staff_id.slice(-8), // Show last 8 chars of ID
        type: 'Staff',
        class: 'N/A'
      };
    }
  }
  
  // If neither student_id nor staff_id, check borrower_type from borrowing-based fines
  if (fine.borrowings) {
    if (fine.borrowings.student_id && fine.borrowings.students) {
    return {
        name: `${fine.borrowings.students.first_name} ${fine.borrowings.students.last_name}`,
        id: fine.borrowings.students.admission_number || fine.borrowings.students.id,
      type: 'Student',
        class: fine.borrowings.students.class_grade || 'N/A'
    };
    } else if (fine.borrowings.staff_id && fine.borrowings.staff) {
    return {
        name: `${fine.borrowings.staff.first_name} ${fine.borrowings.staff.last_name}`,
        id: fine.borrowings.staff.staff_id || fine.borrowings.staff.email,
      type: 'Staff',
        class: fine.borrowings.staff.department || fine.borrowings.staff.position || 'N/A'
    };
    }
  }
  
  return {
    name: 'Unknown Borrower',
    id: 'N/A',
    type: 'Unknown',
    class: 'N/A'
  };
};

export const BorrowingManagement = ({ initialTab = 'overview' }: BorrowingManagementProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showBorrowingForm, setShowBorrowingForm] = useState(false);
  const [showGroupBorrowingForm, setShowGroupBorrowingForm] = useState(false);
  const [showGroupReturnForm, setShowGroupReturnForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const { toast } = useToast();
  const [selectedBorrowing, setSelectedBorrowing] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFineCollectionDialog, setShowFineCollectionDialog] = useState(false);
  const [selectedFine, setSelectedFine] = useState<any>(null);
  const [classFilter, setClassFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [processingReturn, setProcessingReturn] = useState(false);
  
  // Pagination states for all tabs
  const [activePage, setActivePage] = useState(1);
  const [staffPage, setStaffPage] = useState(1);
  const [groupsPage, setGroupsPage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [finesPage, setFinesPage] = useState(1);

  // Use offline-first hooks for better performance and offline capability
  const { data: borrowingsOffline, isLoading: offlineLoading } = useBorrowingsOffline();
  const { data: borrowingsData, isLoading: borrowingsLoading } = useBorrowings(1, 50);
  const { data: overdueData, isLoading: overdueLoading } = useOverdueBorrowings(1, 50);
  
  // Prefer offline data, fallback to online data
  const borrowings = borrowingsOffline || borrowingsData?.data || [];
  const totalBorrowings = borrowingsData?.totalCount || 0;
  const overdueBorrowings = overdueData?.data || [];
  const totalOverdue = overdueData?.totalCount || 0;
  const { data: fineCollection, isLoading: finesLoading } = useFineCollection();
  const { data: allFines } = useFines();
  const { groupBorrowings, groupBorrowingsLoading } = useGroupBorrowings();
  const payFine = usePayFine();
  const clearFine = useClearFine();
  const collectFine = useCollectFine();
  const returnBorrowing = useReturnBorrowing();
  const createBorrowing = useCreateBorrowing();
  const createGroupBorrowing = useCreateGroupBorrowing();
  const returnGroupBorrowing = useReturnGroupBorrowing();
  const { updatePageState } = useDocumentMetaContext();
  const { data: classes } = useClassesOffline();
  const { data: studentsResponse } = useStudents();
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const { data: theftReports } = useTheftReports();
  const queryClient = useQueryClient();

  // Refresh fines data when the fines tab is selected
  useEffect(() => {
    if (activeTab === 'fines') {
      // Force a refetch of the fines data
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      console.log('Refreshing fines data for the fines tab');
    }
  }, [activeTab, queryClient]);

  const activeBorrowings = borrowings?.filter(b => b.status === 'active') || [];
  const recentReturns = borrowings?.filter(b => b.status === 'returned').slice(0, 5) || [];
  const totalFines = fineCollection?.reduce((sum, item) => sum + (item.total_fine_amount || 0), 0) || 0;
  
  // Show all fines from both sources: fines table and borrowings with fines
  const finesData = allFines || [];
  const borrowingsWithFines = borrowings?.filter(b => b.fine_amount && b.fine_amount > 0 && !(b as any).fine_paid) || [];
  
  // Create combined fines data including borrowings with fines
  const combinedFinesData = [...finesData];
  
  // Add borrowing fines that might not be in the fines table
  borrowingsWithFines.forEach(borrowing => {
    // Check if this borrowing fine is already represented in the fines table
    const alreadyIncluded = finesData.some(fine => 
      fine.borrowing_id === borrowing.id && 
      ((borrowing.student_id && fine.student_id === borrowing.student_id) ||
       ((borrowing as any).staff_id && fine.staff_id === (borrowing as any).staff_id))
    );
    
    // If not already included, add it to the combined data
    if (!alreadyIncluded && borrowing.fine_amount > 0) {
      // Type for staff that includes email
      type StaffWithEmail = {
        id: string;
        first_name: string;
        last_name: string;
        staff_id: string;
        department: string;
        position: string;
        email: string;
      };
      
      // For display purposes only - these are not complete fine objects
      combinedFinesData.push({
        // Use a special ID format that we can detect in handleFineAction
        id: `borrowing-${borrowing.id}`,
        student_id: borrowing.student_id || null,
        staff_id: (borrowing as any).staff_id || null,
        borrowing_id: borrowing.id,
        amount: borrowing.fine_amount,
        fine_type: (borrowing as any).is_lost ? 'lost_book' : 'overdue',
        description: `Fine for ${(borrowing as any).is_lost ? 'lost' : 'overdue'} book: ${(borrowing as any).books?.title}`,
        status: 'unpaid',
        created_at: borrowing.updated_at || borrowing.created_at,
        updated_at: borrowing.updated_at || borrowing.created_at,
        borrower_type: borrowing.student_id ? 'student' : 'staff',
        created_by: null,
        // Include the original borrowing data for reference
        students: (borrowing as any).students || null,
        staff: (borrowing as any).staff ? 
          { ...(borrowing as any).staff, email: '' } as StaffWithEmail : 
          null,
        // Include dummy values for other required fields
        borrowings: {
          id: borrowing.id,
          book_id: borrowing.book_id,
          student_id: borrowing.student_id,
          staff_id: (borrowing as any).staff_id,
          books: (borrowing as any).books,
          students: (borrowing as any).students,
          staff: (borrowing as any).staff ? 
            { ...(borrowing as any).staff, email: '' } as StaffWithEmail : 
            null
        }
      });
    }
  });

  // Debug logs for fines data
  console.log('Original fines data:', finesData.length);
  console.log('Borrowings with fines:', borrowingsWithFines.length);
  console.log('Combined fines:', combinedFinesData.length);

  // Predefined color mappings to fix icon display issues
  const colorMappings = {
    blue: {
      gradient: 'from-blue-600 to-blue-700',
      background: 'from-blue-400/20 to-blue-600/20'
    },
    red: {
      gradient: 'from-red-600 to-red-700',
      background: 'from-red-400/20 to-red-600/20'
    },
    green: {
      gradient: 'from-green-600 to-green-700',
      background: 'from-green-400/20 to-green-600/20'
    },
    yellow: {
      gradient: 'from-yellow-600 to-yellow-700',
      background: 'from-yellow-400/20 to-yellow-600/20'
    }
  };

  // Filter active borrowings based on search with priority for admission number
  const filteredActiveBorrowings = activeBorrowings.filter(borrowing => {
    const admissionNumber = (borrowing as any).students?.admission_number?.toLowerCase() || '';
    const studentName = `${(borrowing as any).students?.first_name} ${(borrowing as any).students?.last_name}`.toLowerCase();
    const bookTitle = (borrowing as any).books?.title?.toLowerCase() || '';
    const classGrade = (borrowing as any).students?.class_grade?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();

    return admissionNumber.includes(search) ||
           studentName.includes(search) || 
           bookTitle.includes(search) || 
           classGrade.includes(search);
  }).sort((a, b) => {
    // Prioritize exact admission number matches first
    const search = searchQuery.toLowerCase();
    const aAdmissionMatch = ((a as any).students?.admission_number?.toLowerCase() || '').startsWith(search);
    const bAdmissionMatch = ((b as any).students?.admission_number?.toLowerCase() || '').startsWith(search);
    if (aAdmissionMatch && !bAdmissionMatch) return -1;
    if (!aAdmissionMatch && bAdmissionMatch) return 1;
    return 0;
  });

  // Helper function to get paginated data
  const getPaginatedData = (data: any[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  };

  // Get total pages for pagination
  const getTotalPages = (dataLength: number) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  // Paginated data for each tab
  const paginatedActiveBorrowings = getPaginatedData(filteredActiveBorrowings.filter(b => (b as any).borrower_type === 'student' || !(b as any).borrower_type), activePage);
  const paginatedStaffBorrowings = getPaginatedData(filteredActiveBorrowings.filter(b => (b as any).borrower_type === 'staff'), staffPage);
  const paginatedGroupBorrowings = getPaginatedData(groupBorrowings || [], groupsPage);
  const paginatedOverdueBorrowings = getPaginatedData(overdueBorrowings || [], overduePage);
  const paginatedReturns = getPaginatedData(recentReturns, returnsPage);
  const paginatedFines = getPaginatedData(combinedFinesData, finesPage);

  const calculateDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return Math.max(0, differenceInDays(today, due));
  };

  const getStatusBadge = (dueDate: string) => {
    const daysOverdue = calculateDaysOverdue(dueDate);
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = differenceInDays(due, today);

    if (daysOverdue > 0) {
      return (
        <Badge variant="destructive" className="font-medium">
          {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
        </Badge>
      );
    } else if (daysUntilDue <= 1) {
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
          Due {daysUntilDue === 0 ? 'today' : 'tomorrow'}
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''} left
        </Badge>
      );
    }
  };

  const handleReturnBook = (borrowing: any) => {
    setSelectedBorrowing(borrowing);
    setShowReturnForm(true);
    // Update document meta when opening return form
    updatePageState('idle', `Returning Book: ${(borrowing as any).books?.title}`);
  };

  const handleReturnSubmit = async (returnData: any) => {
    console.log('Return data received:', returnData);

    try {
      // Update document meta to show submitting state
      updatePageState('submitting', 'Processing Book Return');
      
      // Check if this is a theft case
      if (returnData.isTheft) {
        console.log('Processing theft case...');

        // Create a fine for the thief
        if (returnData.thiefStudentId) {
          const fineAmount = returnData.theftFineAmount || 800;
          
          await supabase.from('fines').insert({
            student_id: returnData.thiefStudentId,
            amount: fineAmount,
            fine_type: 'theft',
            description: `Theft fine for book: ${returnData.bookTitle || 'Unknown book'}. Tracking code: ${returnData.returned_tracking_code}`,
            status: 'unpaid',
            created_at: new Date().toISOString(),
            related_borrowing_id: returnData.borrowing_id
          });
          
          console.log(`Created theft fine for student ${returnData.thiefStudentId}`);
        }
        
        // Return the book to the victim's account
        await returnBorrowing.mutateAsync({
          id: returnData.borrowing_id,
          returned_tracking_code: returnData.returned_tracking_code,
          expected_tracking_code: returnData.expected_tracking_code,
          condition_at_return: returnData.condition_at_return,
          return_notes: `Book was stolen but has been recovered. ${returnData.return_notes || ''}`,
          is_theft: true,
          student_id: returnData.student_id,
          book_id: returnData.book_id,
          book_copy_id: returnData.book_copy_id,
          returned_date: returnData.returned_date,
          days_overdue: returnData.days_overdue,
          fine_amount: 0, // No fine for the victim
          prevent_auto_fine: true,
          book_verified: false
        });
      } else {
        // Normal return process
        await returnBorrowing.mutateAsync({
          id: returnData.borrowing_id,
          returned_tracking_code: returnData.returned_tracking_code,
          expected_tracking_code: returnData.expected_tracking_code,
          condition_at_return: returnData.condition_at_return,
          return_notes: returnData.return_notes,
          is_lost: returnData.is_lost,
          lost_reason: returnData.lost_reason,
          student_id: returnData.student_id,
          book_id: returnData.book_id,
          book_copy_id: returnData.book_copy_id,
          returned_date: returnData.returned_date,
          days_overdue: returnData.days_overdue,
          fine_amount: returnData.fine_amount,
          prevent_auto_fine: returnData.prevent_auto_fine,
          book_verified: false
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      
      // Close the form
      setShowReturnForm(false);

      toast({
        title: returnData.isTheft
          ? 'Theft Case Processed'
          : (returnData.isLost ? 'Book Marked as Lost' : 'Book Returned Successfully'),
        description: returnData.fineAmount > 0
          ? `Fine of ${formatCurrency(returnData.fineAmount)} has been recorded.` 
          : 'No fines were applied.',
        duration: 5000,
      });
      
      // Log the activity
      await logActivity(
        returnData.isTheft ? 'theft_processed' : (returnData.isLost ? 'book_lost' : 'book_returned'),
        'borrowing',
        returnData.borrowing_id,
        {
          book_id: returnData.book_id,
          tracking_code: returnData.returned_tracking_code,
          student_id: returnData.student_id,
          fine_amount: returnData.fineAmount,
          condition: returnData.condition_at_return
        }
      );
      
      // Reset page state after a delay
      setTimeout(() => {
        updatePageState('idle', 'Borrowing Management');
      }, 1500);
    } catch (error) {
      console.error('Error returning book:', error);
      toast({
        title: 'Error',
        description: `Failed to process return: ${error.message}`,
        variant: 'destructive',
      });
      updatePageState('error', 'Error Processing Return');
    }
  };

  const handleFineAction = async (fineId: string, action: string, amount?: number) => {
    try {
      console.log(`Processing fine action: ${action} for fine ID: ${fineId}`);

      // Check if this is a borrowing-based fine (has a "borrowing-" prefix)
      const isBorrowingFine = fineId.startsWith('borrowing-');
      
      if (isBorrowingFine) {
        // Extract the borrowing ID from the fine ID
        const borrowingId = fineId.replace('borrowing-', '');
        console.log(`Processing borrowing-based fine for borrowing ID: ${borrowingId}`);
        
        // For borrowing-based fines, we need to update the borrowing record
        switch (action) {
          case 'pay':
          case 'clear':
            // Update the borrowing record to mark the fine as paid
            const { error } = await supabase
              .from('borrowings')
              .update({
                fine_paid: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', borrowingId);
            
            if (error) {
              throw error;
            }
            
            console.log(`Updated borrowing ${borrowingId} to mark fine as paid`);
            break;
          case 'collect':
            // For collect action, we need to:
            // 1. Mark the borrowing fine as paid
            // 2. Create a record in the fines table to track the collection
            
            // First get the borrowing data to create a proper fine record
            const { data: borrowing, error: fetchError } = await supabase
              .from('borrowings')
              .select(`
                *,
                students (
                  id, first_name, last_name, admission_number
                ),
                books (
                  id, title, author
                )
              `)
              .eq('id', borrowingId)
              .single();
              
            if (fetchError) {
              throw fetchError;
            }
            
            if (!borrowing) {
              throw new Error(`Borrowing with ID ${borrowingId} not found`);
            }
            
            // Mark the borrowing fine as paid
            const { error: updateError } = await supabase
              .from('borrowings')
              .update({
                fine_paid: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', borrowingId);
              
            if (updateError) {
              throw updateError;
            }
            
            // Create a record in the fines table for tracking
            if (amount && amount > 0) {
              // Determine the appropriate fine type based on condition
              let fineType = 'overdue';
              
              if ((borrowing as any).is_lost) {
                fineType = 'lost_book';
              } else if (borrowing.condition_at_return === 'damaged') {
                fineType = 'damaged';
              } else if (borrowing.condition_at_return === 'poor') {
                fineType = 'poor_condition';
              } else if (borrowing.condition_at_return === 'fair') {
                fineType = 'fair_condition';
              } else if (new Date(borrowing.due_date) < new Date(borrowing.returned_date || new Date())) {
                fineType = 'late_return';
              }
              
              const description = `Fine collected for ${(borrowing as any).books?.title}: ${borrowing.condition_at_return || 'overdue'} condition`;
              
              const { error: insertError } = await supabase
                .from('fines')
                .insert({
                  student_id: borrowing.student_id,
                  borrowing_id: borrowingId,
                  amount: amount,
                  fine_type: fineType,
                  borrower_type: 'student',
                  status: 'paid', // Already paid/collected
                  description: description,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                
              if (insertError) {
                console.error('Error creating fine record, but payment was processed:', insertError);
                // Don't throw here, we already updated the borrowing
              } else {
                console.log(`Created fine record with type: ${fineType}`);
              }
            }
            
            console.log(`Collected fine for borrowing ${borrowingId}`);
            break;
        }
      } else {
        // Regular fine from the fines table
        switch (action) {
          case 'pay':
            await payFine.mutateAsync(fineId);
            console.log(`Fine ${fineId} marked as paid`);
            break;
          case 'clear':
            await clearFine.mutateAsync(fineId);
            console.log(`Fine ${fineId} cleared`);
            break;
          case 'collect':
            if (amount) {
              await collectFine.mutateAsync({ fineId, amountCollected: amount });
              console.log(`Collected ${amount} for fine ${fineId}`);
            }
            break;
        }
      }
      
      // Force a refresh of the fines data
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      
      // Also refresh the borrowings data in case any related data changed
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['fine-collection'] });
      
      // Show success message
      const actionText = isBorrowingFine ? 'borrowing' : 'fine';
      const actionVerb = action === 'pay' ? 'paid' : (action === 'clear' ? 'cleared' : 'collected');
      
      toast({
        title: 'Success',
        description: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} fine ${actionVerb} successfully`,
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Fine action failed:', error);
      
      // Provide more detailed error information
      let errorMessage = 'An unknown error occurred';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.code === '22P02') {
        errorMessage = 'Invalid input format for the fine ID';
      }
      
      toast({
        title: 'Error',
        description: `Failed to process fine action: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  const handleBorrowingSubmit = async (borrowings: any[]) => {
    try {
      // Create multiple borrowings
      for (const borrowing of borrowings) {
        await createBorrowing.mutateAsync(borrowing);
      }
      setShowBorrowingForm(false);
    } catch (error) {
      console.error('Error creating borrowings:', error);
    }
  };

  const handleGroupBorrowingSubmit = async (groupBorrowing: any) => {
    try {
      console.log('Group borrowing data:', groupBorrowing);
      
      // Check for missing required fields
      if (!groupBorrowing.student_ids || groupBorrowing.student_ids.length === 0) {
        throw new Error('No students selected for group borrowing');
      }
      if (!groupBorrowing.book_id || !groupBorrowing.book_copy_id || !groupBorrowing.tracking_code) {
        throw new Error('Missing book information');
      }
      
      // Use mutateAsync for better error handling
      await createGroupBorrowing.mutateAsync(groupBorrowing);
      
      toast({
        title: 'Success',
        description: 'Book has been successfully issued to the group',
      });
      
      setShowGroupBorrowingForm(false);
    } catch (error: any) {
      console.error('Error in group borrowing submission:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group borrowing. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGroupReturnSubmit = async (returnData: any) => {
    try {
      setProcessingReturn(true);
      // Process the group return using the hook
      await returnGroupBorrowing.mutateAsync(returnData);
      
      setShowGroupReturnForm(false);
      
      // The hook handles all the success logic, toasts, and cache invalidation
    } catch (error) {
      console.error('Error processing group return:', error);
      // The hook handles error toasts, so we don't need to show one here
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    total,
    icon: Icon, 
    description, 
    trend,
    color = 'blue'
  }: { 
    title: string; 
    value: number; 
    total?: number;
    icon: any; 
    description: string; 
    trend?: { value: number; isPositive: boolean };
    color?: keyof typeof colorMappings;
  }) => (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colorMappings[color].background} rounded-full -mr-10 -mt-10`}></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 bg-gradient-to-r ${colorMappings[color].gradient} rounded-lg flex items-center justify-center`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            {trend && (
              <Badge 
                variant={trend.isPositive ? "default" : "secondary"} 
                className={`${trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </Badge>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold">{value}</span>
              {total !== undefined && total > 0 && (
                <span className="text-sm text-gray-500">
                  of {total}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render a borrowing row with group indicator if it's a group borrowing
  const renderBorrowingRow = (borrowing: any, index: number) => {
    const isGroup = isGroupBorrowing(borrowing);
    const groupInfo = isGroup ? getGroupInfo(borrowing) : null;
    
    return (
      <TableRow key={borrowing.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <div>
              <p className="font-medium">{(borrowing as any).books?.title}</p>
              <p className="text-xs text-gray-500">by {(borrowing as any).books?.author}</p>
              {isGroup && (
                <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Users className="h-3 w-3 mr-1" />
                  Group ({groupInfo?.studentCount} students)
                </Badge>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{(borrowing as any).students?.first_name} {(borrowing as any).students?.last_name}</p>
            <p className="text-xs text-gray-500">{(borrowing as any).students?.admission_number} • {(borrowing as any).students?.class_grade}</p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{(borrowing as any).books?.title}</p>
            <p className="text-xs text-gray-500">by {(borrowing as any).books?.author}</p>
            {borrowing.tracking_code && (
              <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded w-fit">
                {borrowing.tracking_code}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{format(new Date(borrowing.due_date), 'MMM dd, yyyy')}</p>
            <p className="text-xs text-gray-500">
              {format(new Date(borrowing.due_date), 'EEEE')}
            </p>
          </div>
        </TableCell>
        <TableCell>
          {getStatusBadge(borrowing.due_date)}
        </TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            onClick={() => handleReturnBook(borrowing)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Return Book
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  // Render pagination component
  const renderPagination = (currentPage: number, totalPages: number, setPage: (page: number) => void) => {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-4 flex justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={currentPage === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return null;
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  // Loading and empty state components
  const LoadingState = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center py-4">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
        </div>
      </TableCell>
    </TableRow>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <TableRow>
      <TableCell colSpan={6} className="text-center py-4 text-gray-500">
        {message}
      </TableCell>
    </TableRow>
  );

  const GroupsContent = () => {
    // First filter by active status, then by class if selected
    const activeGroupBorrowings = groupBorrowings?.filter(borrowing => 
      borrowing.status === 'active' && // Only show active borrowings
      (classFilter === 'all' || borrowing.student_ids.some(id => {
        const student = students?.find(s => s.id === id);
        return student?.class_id === classFilter;
      }))
    ) || [];

    const paginatedBorrowings = getPaginatedData(activeGroupBorrowings, groupsPage);
    const totalPages = getTotalPages(activeGroupBorrowings.length);

    if (groupBorrowingsLoading) return <LoadingState />;
    if (!activeGroupBorrowings.length) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <UsersRound className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Group Borrowings</h3>
          <p className="text-muted-foreground mb-4">There are no active group borrowings at the moment.</p>
          <Button onClick={() => setShowGroupBorrowingForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Group Borrowing
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Active Group Borrowings</h3>
            <p className="text-sm text-muted-foreground">
              Showing {activeGroupBorrowings.length} active group {activeGroupBorrowings.length === 1 ? 'borrowing' : 'borrowings'}
            </p>
          </div>
          <Button onClick={() => setShowGroupBorrowingForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Group Borrowing
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Group Size</TableHead>
              <TableHead>Tracking Code</TableHead>
              <TableHead>Borrowed Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBorrowings.map((borrowing) => (
              <TableRow key={borrowing.id}>
                <TableCell className="font-medium">
                  {borrowing.books?.title || 'Unknown Book'}
                  <div className="text-sm text-muted-foreground">
                    by {borrowing.books?.author || 'Unknown Author'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                    {borrowing.student_count} students
                  </div>
                </TableCell>
                <TableCell>
                  <code className="px-2 py-1 bg-muted rounded text-sm">
                    {borrowing.tracking_code}
                  </code>
                </TableCell>
                <TableCell>
                  {format(new Date(borrowing.borrowed_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {format(new Date(borrowing.due_date), 'MMM d, yyyy')}
                    {getStatusBadge(borrowing.due_date)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBorrowing(borrowing);
                      setShowGroupReturnForm(true);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Return
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && renderPagination(groupsPage, totalPages, setGroupsPage)}
      </div>
    );
  };

  if (showBorrowingForm) {
    return (
      <NewBorrowingForm
        onSubmit={handleBorrowingSubmit}
        onCancel={() => setShowBorrowingForm(false)}
      />
    );
  }

  if (showGroupBorrowingForm) {
    return (
      <GroupBorrowingForm
        onSubmit={handleGroupBorrowingSubmit}
        onCancel={() => setShowGroupBorrowingForm(false)}
      />
    );
  }

  if (showReturnForm) {
    if (!selectedBorrowing) {
      // If no borrowing is selected, close the form and show an error
      setShowReturnForm(false);
      toast({
        title: 'Error',
        description: 'No borrowing selected for return',
        variant: 'destructive',
      });
      return null;
    }
    
    return (
      <BookReturnForm
        initialBorrowing={selectedBorrowing}
        onSubmit={handleReturnSubmit}
        onCancel={() => {
          setShowReturnForm(false);
          setSelectedBorrowing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold">Borrowing Management</h1>
            </div>
            <p className="text-blue-100 text-lg">
              Issue books, process returns, and manage library circulation
            </p>
            <div className="flex items-center space-x-4 mt-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Professional System
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Real-time Tracking
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <TabsList className="grid grid-cols-2 lg:grid-cols-7 w-full bg-transparent gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <Activity className="w-4 h-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <BookOpen className="w-4 h-4 mr-1" />
              Students
            </TabsTrigger>
            <TabsTrigger value="staff" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <User className="w-4 h-4 mr-1" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="groups" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <Users className="w-4 h-4 mr-1" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="overdue" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Overdue
            </TabsTrigger>
            <TabsTrigger value="returns" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <RotateCcw className="w-4 h-4 mr-1" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="fines" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-md transition-all">
              <Currency className="w-4 h-4 mr-1" />
              Fines
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Active Borrowings" value={activeBorrowings.length} total={totalBorrowings} icon={Activity} description="Currently borrowed books" />
            <StatCard title="Overdue Books" value={overdueBorrowings.length} total={totalOverdue} icon={AlertTriangle} description="Books past due date" color="red" />
            <StatCard 
              title="Recent Returns" 
              value={recentReturns.length} 
              total={recentReturns.length} 
              icon={RotateCcw} 
              description="Books returned recently" 
              color="green" 
            />
            <StatCard 
              title="Outstanding Fines" 
              value={combinedFinesData.filter(f => f.status === 'unpaid').length} 
              total={combinedFinesData.length}
              icon={Currency} 
              description="Fines to collect" 
              color="yellow" 
            />
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Issue Book */}
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Issue Book</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <BookOpen className="h-12 w-12 text-blue-600" />
                  <Button onClick={() => setShowBorrowingForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    Issue Book
                  </Button>
                </div>
              </CardContent>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-blue-600/20 pointer-events-none" />
            </Card>

            {/* Group Borrowing */}
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Group Borrowing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Users className="h-12 w-12 text-blue-600" />
                  <Button onClick={() => setShowGroupBorrowingForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    Issue to Group
                  </Button>
                </div>
              </CardContent>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-blue-600/20 pointer-events-none" />
            </Card>

            {/* Process Return */}
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Process Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <RotateCcw className="h-12 w-12 text-blue-600" />
                  <Button onClick={() => setShowReturnForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    Process Return
                  </Button>
                </div>
              </CardContent>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-blue-600/20 pointer-events-none" />
            </Card>

            {/* Group Return */}
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Group Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <UsersRound className="h-12 w-12 text-blue-600" />
                  <Button onClick={() => setShowGroupReturnForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    Return Group Book
                  </Button>
                </div>
              </CardContent>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-blue-600/20 pointer-events-none" />
            </Card>
          </div>
        </TabsContent>

        {/* Student Borrowings Tab */}
        <TabsContent value="active" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {borrowingsLoading ? (
                  <LoadingState />
                ) : paginatedActiveBorrowings.length === 0 ? (
                  <EmptyState message="No active student borrowings found" />
                ) : (
                  paginatedActiveBorrowings.map((borrowing, idx) => renderBorrowingRow(borrowing, idx))
                )}
              </TableBody>
            </Table>
          </div>
          {!borrowingsLoading && renderPagination(activePage, getTotalPages(filteredActiveBorrowings.filter(b => (b as any).borrower_type === 'student' || !(b as any).borrower_type).length), setActivePage)}
        </TabsContent>

        {/* Staff Borrowings Tab */}
        <TabsContent value="staff" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {borrowingsLoading ? (
                  <LoadingState />
                ) : paginatedStaffBorrowings.length === 0 ? (
                  <EmptyState message="No active staff borrowings found" />
                ) : (
                  paginatedStaffBorrowings.map((borrowing, idx) => renderBorrowingRow(borrowing, idx))
                )}
              </TableBody>
            </Table>
          </div>
          {!borrowingsLoading && renderPagination(staffPage, getTotalPages(filteredActiveBorrowings.filter(b => (b as any).borrower_type === 'staff').length), setStaffPage)}
        </TabsContent>

        {/* Group Borrowings Tab */}
        <TabsContent value="groups" className="space-y-6">
          <GroupsContent />
        </TabsContent>

        {/* Overdue Borrowings Tab */}
        <TabsContent value="overdue" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueLoading ? (
                  <LoadingState />
                ) : paginatedOverdueBorrowings.length === 0 ? (
                  <EmptyState message="No overdue books found" />
                ) : (
                  paginatedOverdueBorrowings.map((borrowing) => {
                    const daysOverdue = calculateDaysOverdue(borrowing.due_date);
                    return (
                      <TableRow key={borrowing.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="font-medium">{borrowing.books?.title}</p>
                              <p className="text-xs text-gray-500">by {borrowing.books?.author}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(borrowing as any).borrower_type === 'staff' ? (
                            <div>
                              <p className="font-medium">{(borrowing as any).staff?.first_name} {(borrowing as any).staff?.last_name}</p>
                              <p className="text-xs text-gray-500">{(borrowing as any).staff?.staff_id} • {(borrowing as any).staff?.department}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium">{(borrowing as any).students?.first_name} {(borrowing as any).students?.last_name}</p>
                              <p className="text-xs text-gray-500">{(borrowing as any).students?.admission_number} • {(borrowing as any).students?.class_grade}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {borrowing.tracking_code && (
                            <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded w-fit">
                              {borrowing.tracking_code}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{format(new Date(borrowing.due_date), 'MMM dd, yyyy')}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(borrowing.due_date), 'EEEE')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="font-medium">
                            {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleReturnBook(borrowing)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Return Book
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {!overdueLoading && renderPagination(overduePage, getTotalPages((overdueBorrowings || []).length), setOverduePage)}
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Borrowed</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Fine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {borrowingsLoading ? (
                  <LoadingState />
                ) : paginatedReturns.length === 0 ? (
                  <EmptyState message="No recent returns found" />
                ) : (
                  paginatedReturns.map((borrowing) => (
                    <TableRow key={borrowing.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{borrowing.books?.title}</p>
                            <p className="text-xs text-gray-500">by {borrowing.books?.author}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(borrowing as any).borrower_type === 'staff' ? (
                          <div>
                            <p className="font-medium">{(borrowing as any).staff?.first_name} {(borrowing as any).staff?.last_name}</p>
                            <p className="text-xs text-gray-500">{(borrowing as any).staff?.staff_id} • {(borrowing as any).staff?.department}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">{(borrowing as any).students?.first_name} {(borrowing as any).students?.last_name}</p>
                            <p className="text-xs text-gray-500">{(borrowing as any).students?.admission_number} • {(borrowing as any).students?.class_grade}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {borrowing.borrowed_date && format(new Date(borrowing.borrowed_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {borrowing.returned_date && format(new Date(borrowing.returned_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          borrowing.condition_at_return === 'excellent' || borrowing.condition_at_return === 'good' 
                            ? 'secondary' 
                            : borrowing.condition_at_return === 'fair' 
                              ? 'outline' 
                              : 'destructive'
                        } className={
                          borrowing.condition_at_return === 'excellent' || borrowing.condition_at_return === 'good' 
                            ? 'bg-green-100 text-green-700' 
                            : borrowing.condition_at_return === 'fair' 
                              ? 'border-amber-300 text-amber-700 bg-amber-50' 
                              : ''
                        }>
                          {borrowing.condition_at_return?.charAt(0).toUpperCase() + borrowing.condition_at_return?.slice(1) || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {borrowing.fine_amount > 0 ? (
                          <Badge variant="destructive" className="font-medium">
                            {formatCurrency(borrowing.fine_amount)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            No fine
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!borrowingsLoading && renderPagination(returnsPage, getTotalPages(recentReturns.length), setReturnsPage)}
        </TabsContent>

        {/* Fines Tab */}
        <TabsContent value="fines" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Fines</CardTitle>
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search fines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[300px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Fine Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finesLoading ? (
                      <LoadingState />
                    ) : paginatedFines.length === 0 ? (
                      <EmptyState message="No fines found" />
                    ) : (
                      paginatedFines.map((fine: any) => {
                        const borrower = getBorrowerDetails(fine);
                        return (
                          <TableRow key={fine.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{borrower.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Badge variant="outline" className={cn(
                                    "bg-gray-50",
                                    borrower.type === 'Staff' ? "text-blue-700 border-blue-200" : "text-gray-700 border-gray-200"
                                  )}>
                                    {borrower.type}
                                  </Badge>
                                  {borrower.id} • {borrower.class}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium capitalize">{getFineTypeDescription(fine)}</p>
                                <p className="text-xs text-gray-500">{fine.description}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{formatCurrency(fine.amount)}</div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  fine.status === 'unpaid' ? 'destructive' :
                                  fine.status === 'paid' ? 'default' :
                                  'secondary'
                                }
                                className="capitalize"
                              >
                                {fine.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{format(new Date(fine.created_at), 'MMM dd, yyyy')}</p>
                                <p className="text-xs text-gray-500">{format(new Date(fine.created_at), 'HH:mm')}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {fine.status === 'unpaid' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedFine(fine);
                                        setShowFineCollectionDialog(true);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      <DollarSign className="w-4 h-4 mr-1" />
                                      Collect
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleFineAction(fine.id, 'clear')}
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Clear
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {!finesLoading && renderPagination(finesPage, getTotalPages(combinedFinesData.length), setFinesPage)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Group Return Dialog */}
      <Dialog open={showGroupReturnForm} onOpenChange={setShowGroupReturnForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              Process Group Return
            </DialogTitle>
            <DialogDescription>
              Search for a student in the group to process the return, or enter the book tracking code directly
            </DialogDescription>
          </DialogHeader>
          
          <GroupReturnForm 
            onSubmit={handleGroupReturnSubmit}
            onCancel={() => setShowGroupReturnForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Fine Collection Dialog */}
      {selectedFine && (
        <FineCollectionReceiptDialog
          isOpen={showFineCollectionDialog}
          onClose={() => {
            setShowFineCollectionDialog(false);
            setSelectedFine(null);
          }}
          borrowerName={
            selectedFine.student_id 
              ? (selectedFine.students 
              ? `${selectedFine.students.first_name} ${selectedFine.students.last_name}` 
                  : 'Unknown Student')
              : (selectedFine.staff
                  ? `${selectedFine.staff.first_name} ${selectedFine.staff.last_name}`
                  : 'Unknown Staff')
          }
          borrowerType={selectedFine.student_id ? 'Student' : 'Staff'}
          fineAmount={selectedFine.amount || 0}
          fineType={selectedFine.fine_type || 'fine'}
          bookTitle={
            selectedFine.borrowings?.books?.title || 
            (selectedFine.books ? selectedFine.books.title : undefined)
          }
          onConfirm={() => {
            const isBorrowingFine = selectedFine.id.startsWith('borrowing-');
            
            if (isBorrowingFine) {
              // For borrowing-based fines, call handleFineAction with 'pay'
              handleFineAction(selectedFine.id, 'pay');
            } else {
              // For regular fines, call handleFineAction with 'collect' and the amount
              handleFineAction(selectedFine.id, 'collect', selectedFine.amount);
            }
            setShowFineCollectionDialog(false);
            setSelectedFine(null);
          }}
        />
      )}
    </div>
  );
};

