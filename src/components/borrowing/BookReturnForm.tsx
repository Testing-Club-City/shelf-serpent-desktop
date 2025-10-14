import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Search, CheckCircle, AlertCircle, BookOpen,
  User, Calendar, ScrollText, AlertTriangle, BookX, Shield, Users
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, differenceInDays } from 'date-fns';
import { useBorrowingsArray, useBookReturn } from '@/hooks/useBorrowings';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateConditionFine, useDetectTheft, useHandleFoundLostBook, getFineAmountBySetting } from '@/hooks/useFineManagement';
import { useDocumentMetaContext } from '@/hooks/useDocumentMetaContext';
import { supabase } from '@/integrations/supabase/client';

const FormSchema = z.object({
  returned_tracking_code: z.string().min(1, 'Please select or enter a tracking code'),
  condition_at_return: z.string().min(1, 'Please select the condition'),
  return_notes: z.string().optional(),
  fine_amount: z.number().min(0, 'Fine amount must be non-negative'),
  is_lost: z.boolean().default(false),
  lost_reason: z.string().optional(),
});

type FormData = z.infer<typeof FormSchema>;

interface BookReturnFormProps {
  initialBorrowing?: any; // Made optional
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

type Borrowing = Tables<'borrowings'> & {
  students?: Tables<'students'>;
  books?: Tables<'books'>;
  book_copies?: Tables<'book_copies'>;
};

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

export const BookReturnForm = ({ initialBorrowing, onSubmit, onCancel }: BookReturnFormProps) => {
  // Hooks - Optimized for performance
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  const detectTheft = useDetectTheft();
  const handleFoundLostBook = useHandleFoundLostBook();
  const { updatePageState } = useDocumentMetaContext();

  // State declarations
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(initialBorrowing || null);
  const [isGroupReturn, setIsGroupReturn] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ studentCount: number; groupId: string | null } | null>(null);
  const [groupBorrowings, setGroupBorrowings] = useState<Borrowing[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerifiedCode, setLastVerifiedCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'identification' | 'return'>('identification');
  const [isTheft, setIsTheft] = useState(false);
  const [theftDetails, setTheftDetails] = useState<any>(null);
  const [manualFineOverride, setManualFineOverride] = useState<number | null>(null);
  const [calculatedFine, setCalculatedFine] = useState(0);
  const [fairFine, setFairFine] = useState(50);
  const [poorFine, setPoorFine] = useState(150);
  const [damagedFine, setDamagedFine] = useState(300);
  const [lostFine, setLostFine] = useState(500);
  const [overdueFine, setOverdueFine] = useState(10);
  const [isFoundLostBook, setIsFoundLostBook] = useState(false);
  const [theftFineAmount, setTheftFineAmount] = useState(800);
  const [dismissedUnauthorizedCodes, setDismissedUnauthorizedCodes] = useState<Set<string>>(new Set());

  // Initialize form
  const form = useForm<any>({
    resolver: zodResolver(FormSchema) as any,
    defaultValues: {
      returned_tracking_code: '',
      condition_at_return: 'good',
      return_notes: '',
      fine_amount: 0,
      is_lost: false,
    },
  });

  // Form and watched values
  const watchedTrackingCode = form.watch('returned_tracking_code');
  const isLost = form.watch('is_lost');

  // Removed filteredBorrowings - using direct database queries for performance
  
  // Helper functions moved inside component to fix scoping
  const calculateDaysOverdue = (dueDate: Date | string, returnDate: Date | string = getSafeCurrentDate()) => {
    try {
      const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
      const ret = typeof returnDate === 'string' ? new Date(returnDate) : returnDate;
      
      // Validate dates
      if (isNaN(due.getTime()) || isNaN(ret.getTime())) {
        console.warn('Invalid date values:', { dueDate, returnDate });
        return 0;
      }
      
      const diffTime = Math.max(0, ret.getTime() - due.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error('Error calculating days overdue:', error);
      return 0;
    }
  };

  const getConditionDescription = (condition: string) => {
    const descriptions: Record<string, string> = {
      excellent: "Like new, no visible wear (No fine)",
      good: "Minor wear, all pages intact (No fine)",
      fair: `Noticeable wear, but functional (KES ${fairFine} fine)`,
      poor: `Significant wear, may need repair (KES ${poorFine} fine)`,
      damaged: `Damaged, requires immediate attention (KES ${damagedFine} fine)`,
      lost: `Book has been reported as lost (KES ${lostFine} fine)`,
    };
    return descriptions[condition] || "";
  };

  const getConditionValue = (condition: string) => {
    switch (condition) {
      case 'excellent': return 100;
      case 'good': return 75;
      case 'fair': return 50;
      case 'poor': return 25;
      case 'lost': return 0;
      case 'theft': return 0;
      default: return 0;
    }
  };

  // Ultra-fast book verification optimized for 500k+ records
  const verifyTrackingCode = useCallback(async (trackingCode: string) => {
    if (!trackingCode || !trackingCode.trim()) {
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);
    setLastVerifiedCode(trackingCode);
    
    const inputCode = trackingCode.trim();
    const legacyBookId = parseInt(inputCode);
    
    if (isNaN(legacyBookId)) {
      updatePageState('error', 'Invalid book ID format');
      setSelectedBorrowing(null);
      setIsVerifying(false);
      return;
    }

    try {
      console.log('⚡ Ultra-fast verification for legacy book ID:', legacyBookId);
      
      // Use new ultra-fast verification command
      const result = await invoke('verify_book_instant', {
        legacyBookId: legacyBookId
      });
      
      if (!result.found) {
        updatePageState('error', result.error || `No book found with ID ${inputCode}`);
        setSelectedBorrowing(null);
        setIsVerifying(false);
        return;
      }
      
      if (!result.is_borrowed) {
        // Check if user already dismissed this code
        if (dismissedUnauthorizedCodes.has(inputCode)) {
          // User already clicked cancel for this code - don't show popup again
          setIsVerifying(false);
          return;
        }
        
        // Book exists but wasn't issued - show popup for unauthorized book fine
        const shouldFine = window.confirm(
          `⚠️ UNAUTHORIZED BOOK DETECTED\n\n` +
          `Book: ${result.title}\n` +
          `Legacy ID: ${inputCode}\n\n` +
          `This book was never issued and should be in the library.\n` +
          `The student may have taken it without permission.\n\n` +
          `Click OK to apply unauthorized book fine (KES 200)\n` +
          `Click Cancel to dismiss without fine`
        );
        
        if (shouldFine) {
          // Apply unauthorized book fine
          setIsTheft(true);
          setTheftDetails({
            unauthorizedBook: true,
            bookCode: inputCode,
            bookTitle: result.title,
            bookAuthor: result.author,
            fineAmount: 200,
            reason: 'Unauthorized book possession - book was never issued'
          });
          setTheftFineAmount(200);
          
          // Create a mock borrowing for the fine process
          const mockBorrowing = {
            id: 'unauthorized-' + Date.now(),
            student_id: initialBorrowing?.student_id || 'unknown',
            book_id: 'unknown',
            book_copy_id: 'unknown',
            borrowed_date: getSafeISOString(),
            due_date: getSafeISOString(),
            returned_date: null,
            status: 'unauthorized',
            fine_amount: 200,
            notes: 'Unauthorized book possession',
            condition_at_issue: 'unknown',
            condition_at_return: null,
            copy_condition: null,
            is_lost: false,
            returned_by: null,
            return_notes: null,
            borrower_type: 'student',
            group_borrowing_id: null,
            staff_id: null,
            created_at: getSafeISOString(),
            updated_at: getSafeISOString(),
            deleted: false,
            tracking_code: inputCode,
            students: (initialBorrowing as any)?.students || { first_name: 'Unknown', last_name: 'Student' },
            books: { title: result.title, author: result.author },
            book_copies: { legacy_book_id: result.legacy_book_id }
          } as any;
          setSelectedBorrowing(mockBorrowing);
          updatePageState('error', `⚠️ UNAUTHORIZED: Book was never issued - Fine applied`);
        } else {
          // User cancelled - add to dismissed set and clear the input
          setDismissedUnauthorizedCodes(prev => new Set([...prev, inputCode]));
          form.setValue('returned_tracking_code', '');
          setLastVerifiedCode('');
          updatePageState('idle', 'Scan a book to begin return process');
          setSelectedBorrowing(null);
        }
        setIsVerifying(false);
        return;
      }
      
      const borrowingData = result.borrowing;
      console.log('📊 Borrowing data received:', borrowingData);
      console.log('📊 Student data in borrowing:', borrowingData?.student);
      
      // GROUP BORROWING DETECTION AND VALIDATION
      if (borrowingData.group_borrowing_id || isGroupBorrowing(borrowingData)) {
        console.log('👥 GROUP BORROWING DETECTED - Validating group membership');
        
        try {
          // Fetch all borrowings for this group
          const groupBorrowingsResult = await invoke('get_borrowings_by_group_id', {
            groupId: borrowingData.group_borrowing_id || getGroupInfo(borrowingData)?.groupId
          });
          
          const groupBorrowings = groupBorrowingsResult.borrowings || [];
          console.log('👥 Group borrowings found:', groupBorrowings.length);
          
          // Check if this specific book belongs to this group
          const bookInGroup = groupBorrowings.some((gb: any) => 
            gb.tracking_code === inputCode || gb.book_copy_id === result.book_copy_id
          );
          
          if (!bookInGroup) {
            // Book doesn't belong to this group - potential theft
            updatePageState('error', `⚠️ INVALID GROUP RETURN: This book does not belong to the group borrowing`);
            setIsTheft(true);
            setTheftDetails({
              groupTheft: true,
              bookCode: inputCode,
              expectedGroupId: borrowingData.group_borrowing_id || getGroupInfo(borrowingData)?.groupId,
              reason: 'Book does not belong to the specified group borrowing'
            });
            setTheftFineAmount(500);
            
            // Create borrowing object for display
            const borrowingObj = {
              id: borrowingData.id,
              student_id: borrowingData.student_id,
              book_id: 'unknown',
              book_copy_id: 'unknown',
              borrowed_date: borrowingData.borrowed_date,
              due_date: borrowingData.due_date,
              returned_date: null,
              status: borrowingData.status,
              fine_amount: null,
              notes: borrowingData.notes,
              condition_at_issue: 'unknown',
              condition_at_return: null,
              copy_condition: null,
              is_lost: false,
              returned_by: null,
              return_notes: null,
              borrower_type: 'student',
              group_borrowing_id: borrowingData.group_borrowing_id,
              staff_id: null,
              created_at: getSafeISOString(),
              updated_at: getSafeISOString(),
              deleted: false,
              tracking_code: inputCode,
              students: borrowingData.student,
              books: { title: result.title, author: result.author },
              book_copies: { legacy_book_id: result.legacy_book_id }
            } as any;
            setSelectedBorrowing(borrowingObj);
            setIsVerifying(false);
            return;
          }
          
          // Valid group borrowing - set up group return
          const groupInfo = getGroupInfo(borrowingData);
          setIsGroupReturn(true);
          setGroupInfo(groupInfo);
          setGroupBorrowings(groupBorrowings);
          
          // Create borrowing object for group return
          const borrowingObj = {
            id: borrowingData.id,
            student_id: borrowingData.student_id,
            book_id: 'unknown',
            book_copy_id: 'unknown',
            borrowed_date: borrowingData.borrowed_date,
            due_date: borrowingData.due_date,
            returned_date: null,
            status: borrowingData.status,
            fine_amount: null,
            notes: borrowingData.notes,
            condition_at_issue: 'unknown',
            condition_at_return: null,
            copy_condition: null,
            is_lost: false,
            returned_by: null,
            return_notes: null,
            borrower_type: 'student',
            group_borrowing_id: borrowingData.group_borrowing_id,
            staff_id: null,
            created_at: getSafeISOString(),
            updated_at: getSafeISOString(),
            deleted: false,
            tracking_code: inputCode,
            students: borrowingData.student,
            books: { title: result.title, author: result.author },
            book_copies: { legacy_book_id: result.legacy_book_id }
          } as any;
          
          setSelectedBorrowing(borrowingObj);
          setIsTheft(false);
          setTheftDetails(null);
          updatePageState('success', `✅ Group Return Verified: ${result.title} - Group of ${groupInfo?.studentCount || 'multiple'} students`);
          setIsVerifying(false);
          return;
          
        } catch (error) {
          console.error('❌ Error validating group borrowing:', error);
          updatePageState('error', 'Error validating group borrowing');
          setSelectedBorrowing(null);
          setIsVerifying(false);
          return;
        }
      }
      
      // INDIVIDUAL BORROWING THEFT DETECTION: Check if different student is returning
      if (initialBorrowing && initialBorrowing.student_id !== borrowingData.student_id) {
        console.log('🚨 THEFT DETECTED: Different students!');
        setIsTheft(true);
        setTheftDetails({
          victimBorrowing: {
            id: borrowingData.id,
            student_id: borrowingData.student_id,
            students: borrowingData.student,
            books: { title: result.title, author: result.author }
          },
          thiefStudentId: initialBorrowing.student_id,
          bookCode: inputCode
        });
        setTheftFineAmount(800);
        updatePageState('error', `⚠️ THEFT: Book belongs to ${borrowingData.student.first_name} ${borrowingData.student.last_name}, not ${(initialBorrowing as any)?.students?.first_name || 'Unknown'} ${(initialBorrowing as any)?.students?.last_name || 'Student'}`);
        
        // Create borrowing object for display
        const borrowingObj = {
          id: borrowingData.id,
          student_id: borrowingData.student_id,
          book_id: 'unknown',
          book_copy_id: 'unknown',
          borrowed_date: borrowingData.borrowed_date,
          due_date: borrowingData.due_date,
          returned_date: null,
          status: borrowingData.status,
          fine_amount: null,
          notes: null,
          condition_at_issue: 'unknown',
          condition_at_return: null,
          copy_condition: null,
          is_lost: false,
          returned_by: null,
          return_notes: null,
          borrower_type: 'student',
          group_borrowing_id: null,
          staff_id: null,
          created_at: getSafeISOString(),
          updated_at: getSafeISOString(),
          deleted: false,
          tracking_code: inputCode,
          students: borrowingData.student,
          books: { title: result.title, author: result.author },
          book_copies: { legacy_book_id: result.legacy_book_id }
        } as any;
        setSelectedBorrowing(borrowingObj);
        setIsVerifying(false);
        return;
      }
      
      // Valid return - create borrowing object
      const borrowingObj = {
        id: borrowingData.id,
        student_id: borrowingData.student_id,
        book_id: 'unknown',
        book_copy_id: 'unknown',
        borrowed_date: borrowingData.borrowed_date,
        due_date: borrowingData.due_date,
        returned_date: null,
        status: borrowingData.status,
        fine_amount: null,
        notes: null,
        condition_at_issue: 'unknown',
        condition_at_return: null,
        copy_condition: null,
        is_lost: false,
        returned_by: null,
        return_notes: null,
        borrower_type: 'student',
        group_borrowing_id: null,
        staff_id: null,
        created_at: getSafeISOString(),
        updated_at: getSafeISOString(),
        deleted: false,
        tracking_code: inputCode,
        students: borrowingData.student,
        books: { title: result.title, author: result.author },
        book_copies: { legacy_book_id: result.legacy_book_id }
      } as any;
      
      console.log('✅ Valid return confirmed - instant verification');
      console.log('📊 Final borrowing object:', borrowingObj);
      console.log('📊 Students in final object:', borrowingObj.students);
      setSelectedBorrowing(borrowingObj);
      setIsTheft(false);
      setTheftDetails(null);
      setIsGroupReturn(false); // Simplified for performance
      updatePageState('success', `✅ Verified: ${result.title} - ${borrowingData.student.first_name} ${borrowingData.student.last_name}`);
      setIsVerifying(false);
      
    } catch (error) {
      console.error('❌ Verification error:', error);
      updatePageState('error', 'Error verifying book code');
      setSelectedBorrowing(null);
      setIsTheft(false);
      setTheftDetails(null);
      setIsVerifying(false);
    }
  }, [initialBorrowing, updatePageState]);

  // Clear previous verification when user types (manual verification only)
  useEffect(() => {
    if (watchedTrackingCode !== lastVerifiedCode) {
      setSelectedBorrowing(null);
      setIsTheft(false);
      setTheftDetails(null);
      setIsGroupReturn(false);
      setGroupInfo(null);
    }
  }, [watchedTrackingCode, lastVerifiedCode]);

  // When is_lost changes, update the condition to reflect the lost state
  useEffect(() => {
    if (isLost) {
      form.setValue('condition_at_return', 'lost');
      updatePageState('idle', 'Marking Book as Lost');
    } else if (form.getValues('condition_at_return') === 'lost') {
      form.setValue('condition_at_return', 'good');
    }
  }, [isLost, form, updatePageState]);

  // If a specific borrowing is passed as prop, auto-verify it
  useEffect(() => {
    if (initialBorrowing && initialBorrowing.tracking_code) {
      // Set the tracking code in the form
      form.setValue('returned_tracking_code', initialBorrowing.tracking_code);
      
      // Automatically verify the tracking code
      verifyTrackingCode(initialBorrowing.tracking_code);
    }
  }, [initialBorrowing, form, verifyTrackingCode]);

  // Calculate fine when condition or days overdue changes
  useEffect(() => {
    const calculateFine = () => {
      if (!selectedBorrowing) return;

      const condition = form.getValues('condition_at_return');
      const daysOverdue = calculateDaysOverdue(selectedBorrowing.due_date);
      
      let totalFine = 0;

      // Calculate condition-based fine
      if (condition === 'fair') {
        totalFine += fairFine;
      } else if (condition === 'poor') {
        totalFine += poorFine;
      } else if (condition === 'damaged') {
        totalFine += damagedFine;
      }

      // Add overdue fine if applicable
      if (daysOverdue > 0) {
        totalFine += daysOverdue * overdueFine;
      }

      // Set lost fine if book is lost
      if (isLost) {
        totalFine = lostFine;
      }

      // Only update if the fine amount has changed
      if (totalFine !== calculatedFine) {
        setCalculatedFine(totalFine);
        form.setValue('fine_amount', totalFine);
      }
    };

    calculateFine();
  }, [selectedBorrowing, form.getValues('condition_at_return'), isLost, fairFine, poorFine, damagedFine, lostFine, overdueFine]);

  // Load fine amounts from settings once on mount
  useEffect(() => {
    const loadFineAmounts = async () => {
      try {
        const fairAmount = await getFineAmountBySetting('fair_condition');
        const poorAmount = await getFineAmountBySetting('poor_condition');
        const damagedAmount = await getFineAmountBySetting('damaged');
        const lostAmount = await getFineAmountBySetting('lost');
        const overdueAmount = await getFineAmountBySetting('overdue');

        // Only update state if values are different
        if (fairAmount !== fairFine) setFairFine(fairAmount || 50);
        if (poorAmount !== poorFine) setPoorFine(poorAmount || 150);
        if (damagedAmount !== damagedFine) setDamagedFine(damagedAmount || 300);
        if (lostAmount !== lostFine) setLostFine(lostAmount || 500);
        if (overdueAmount !== overdueFine) setOverdueFine(overdueAmount || 10);
      } catch (error) {
        console.error('Error loading fine amounts:', error);
        // Use defaults if loading fails
        if (fairFine !== 50) setFairFine(50);
        if (poorFine !== 150) setPoorFine(150);
        if (damagedFine !== 300) setDamagedFine(300);
        if (lostFine !== 500) setLostFine(500);
        if (overdueFine !== 10) setOverdueFine(10);
      }
    };

    loadFineAmounts();
  }, [fairFine, poorFine, damagedFine, lostFine, overdueFine, setFairFine, setPoorFine, setDamagedFine, setLostFine, setOverdueFine]);

  const handleVerifyClick = () => {
    const trackingCode = form.getValues('returned_tracking_code');
    console.log('🔘 Manual verify clicked with code:', trackingCode);
    
    if (trackingCode && trackingCode.trim()) {
      console.log('✅ Starting ultra-fast verification for:', trackingCode);
      verifyTrackingCode(trackingCode);
    } else {
      console.log('❌ No tracking code to verify');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set the document meta to submitting state
    updatePageState('submitting', isTheft ? 'Processing Theft Case' : isLost ? 'Processing Lost Book' : 'Processing Book Return');
    
    try {
      // Form validation and submission logic
      const formValues = form.getValues();
      
      // Process the form data
      const returnData = {
        // Existing form data processing
        ...formValues,
        // Add required fields
        borrowing_id: selectedBorrowing?.id || (isTheft && theftDetails?.victimBorrowing?.id),
        // Additional fields based on state
        is_theft: isTheft,
        thief_student_id: isTheft ? (initialBorrowing?.student_id || selectedBorrowing?.student_id) : null,
        expected_tracking_code: selectedBorrowing?.tracking_code || (isTheft && theftDetails?.bookCode),
        // For theft cases
        ...(isTheft && theftDetails && {
          theft_reason: theftDetails.unauthorizedBook ? 
            'Unauthorized book possession - book was never issued' : 
            'Book returned by person other than borrower',
          victim_student_id: theftDetails.unauthorizedBook ? null : theftDetails?.victimBorrowing?.student_id,
        }),
        // For lost books
        ...(isLost && {
          is_lost: true,
          lost_reason: formValues.lost_reason || 'Book reported as lost by student'
        }),
        // Set verification status
        book_verified: !isTheft,
        prevent_auto_fine: manualFineOverride !== null,
        // Set fine amount from calculation or manual override
        fine_amount: manualFineOverride !== null ? manualFineOverride : (isTheft ? theftFineAmount : calculatedFine),
        // Add return date
        returned_date: getSafeISOString(),
        // Add student info safely
        student_id: selectedBorrowing?.student_id || (initialBorrowing as any)?.student_id
      };
      
      console.log('Submitting return data:', returnData);
      
      // Extract borrowing ID and prepare return data for backend
      const borrowingId = returnData.borrowing_id;
      if (!borrowingId) {
        throw new Error('Missing borrowing ID');
      }
      
      // Remove borrowing_id from return data since it's passed separately
      const { borrowing_id: _, ...backendReturnData } = returnData;
      
      // Call the onSubmit callback - the parent expects the full returnData object
      await onSubmit(returnData);
      
      // Update document meta to success state
      updatePageState('success', isTheft ? 'Theft Case Processed' : isLost ? 'Book Marked as Lost' : 'Book Return Successful');
      
      // Reset back to idle after a short delay
      setTimeout(() => {
        updatePageState('idle', 'Borrowing Management');
      }, 1500);
    } catch (error) {
      console.error('Error submitting return form:', error);
      updatePageState('error', 'Error Processing Return');
      
      // Reset back to idle after a short delay
      setTimeout(() => {
        updatePageState('idle', 'Return Book');
      }, 1500);
    }
  };

  // This function is already defined above, so we remove this duplicate

  // Helper function to safely format dates
  const safeFormatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Helper function to safely create current date
  const getSafeCurrentDate = () => {
    try {
      const now = new Date();
      if (isNaN(now.getTime())) {
        // Fallback to a valid date if system time is wrong
        console.warn('System date is invalid, using fallback date');
        return new Date('2024-01-01T00:00:00.000Z');
      }
      return now;
    } catch (error) {
      console.error('Error creating current date:', error);
      return new Date('2024-01-01T00:00:00.000Z');
    }
  };

  // Helper function to safely create ISO string
  const getSafeISOString = (date?: Date) => {
    try {
      const targetDate = date || getSafeCurrentDate();
      if (isNaN(targetDate.getTime())) {
        return new Date('2024-01-01T00:00:00.000Z').toISOString();
      }
      return targetDate.toISOString();
    } catch (error) {
      console.error('Error creating ISO string:', error);
      return new Date('2024-01-01T00:00:00.000Z').toISOString();
    }
  };

  // Selected Book Information should only show after verification
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-4">
        <div className="bg-amber-100 p-1.5 rounded-full">
          <BookOpen className="h-5 w-5 text-amber-700" />
        </div>
        <h2 className="text-lg font-semibold">Book Return Process with Verification</h2>
      </div>
      
      <div className="text-sm text-gray-600 mb-6 px-4">
        Return books with automatic fine calculation and verification
      </div>
      
      <Form {...form}>
        <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="identification" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Book Identification
              </TabsTrigger>
              <TabsTrigger value="return" className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Return Details
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="identification" className="py-6 px-4">
              {/* Professional Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Book Identification</h3>
                    <p className="text-sm text-gray-600">Enter the book's legacy ID to verify ownership and process return</p>
                  </div>
                </div>
              </div>

              {/* Verification Status Cards */}
              {watchedTrackingCode && (selectedBorrowing || isTheft) && (
                <div className="mb-6">
                  {isTheft && theftDetails ? (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-red-900 mb-2">Security Alert: Unauthorized Book</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-red-700 font-medium">Book Code: <code className="bg-red-200 px-2 py-1 rounded">{watchedTrackingCode}</code></p>
                              <p className="text-red-700">Rightful Owner: <span className="font-medium">{theftDetails?.victimBorrowing?.students?.first_name} {theftDetails?.victimBorrowing?.students?.last_name}</span></p>
                              <p className="text-red-700">Admission: <span className="font-medium">{theftDetails?.victimBorrowing?.students?.admission_number || 'N/A'}</span></p>
                            </div>
                            <div>
                              <p className="text-red-700">Book: <span className="font-medium">{theftDetails?.victimBorrowing?.books?.title}</span></p>
                              <p className="text-red-700">Issue Date: <span className="font-medium">{safeFormatDate(theftDetails?.victimBorrowing?.borrowed_date)}</span></p>
                            </div>
                          </div>
                          <div className="mt-4 p-3 bg-red-600 text-white rounded-lg">
                            <p className="font-medium text-sm">⚠️ This book belongs to another student. A theft fine will be applied.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isGroupReturn && groupInfo ? (
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-blue-900 mb-2">Group Borrowing Identified</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-blue-700">Book Code: <code className="bg-blue-200 px-2 py-1 rounded">{selectedBorrowing.tracking_code}</code></p>
                              <p className="text-blue-700">Book: <span className="font-medium">{selectedBorrowing.books?.title}</span></p>
                            </div>
                            <div>
                              <p className="text-blue-700">Group Size: <span className="font-medium">{groupInfo.studentCount} students</span></p>
                              <p className="text-blue-700">Return Type: <span className="font-medium">Group Processing</span></p>
                            </div>
                          </div>
                          <div className="mt-4 p-3 bg-blue-600 text-white rounded-lg">
                            <p className="font-medium text-sm">📚 All {groupInfo.studentCount} students in this group will be processed simultaneously.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedBorrowing ? (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-green-900 mb-2">Book Verified Successfully</h4>
                          {isFoundLostBook && (
                            <div className="mb-3 p-2 bg-green-200 rounded-lg">
                              <p className="text-green-800 font-medium text-sm">📚 Previously lost book has been recovered!</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-green-700">Book Code: <code className="bg-green-200 px-2 py-1 rounded">{selectedBorrowing.tracking_code}</code></p>
                              <p className="text-green-700">Student: <span className="font-medium">{selectedBorrowing.students?.first_name && selectedBorrowing.students?.last_name 
                                ? `${selectedBorrowing.students.first_name} ${selectedBorrowing.students.last_name}`
                                : 'Student information not available'
                              }</span></p>
                            </div>
                            <div>
                              <p className="text-green-700">Admission: <span className="font-medium">{selectedBorrowing?.students?.admission_number || 'N/A'}</span></p>
                              <p className="text-green-700">Issue Date: <span className="font-medium">{safeFormatDate(selectedBorrowing.borrowed_date)}</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Professional Process Guide */}
              {!selectedBorrowing && !isTheft && (
                <div className="mb-6 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Return Process Guide</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <p className="text-sm text-gray-700">Enter the book's legacy ID number</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <p className="text-sm text-gray-700">System verifies book ownership</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                        <p className="text-sm text-gray-700">Proceed to return details tab</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                        <p className="text-sm text-gray-700">Complete the return process</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Professional Book Input Section */}
              <FormField
                control={form.control as any}
                name="returned_tracking_code"
                render={({ field }) => (
                  <FormItem className="mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <FormLabel className="text-lg font-semibold text-gray-900">Book Legacy ID</FormLabel>
                          <p className="text-sm text-gray-600">Enter the numeric ID found on the book cover or spine</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              placeholder="Enter legacy book ID (e.g., 460, 466, 780...)"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="pl-12 h-12 text-lg font-mono border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              type="number"
                            />
                          </div>
                        </FormControl>
                      
                        {!field.value && (
                          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                              <BookOpen className="h-8 w-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 mb-2">Ready to Scan Book</h4>
                            <p className="text-gray-600 mb-1">Enter the legacy book ID to identify the borrowing</p>
                            <p className="text-sm text-gray-500 mb-4">Legacy IDs are typically found on book covers or spines</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => (document.querySelector('input[type="number"]') as HTMLInputElement)?.focus()}
                              className="bg-white hover:bg-gray-50"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Enter Legacy ID
                            </Button>
                          </div>
                        )}

                        {/* Professional Verify Button */}
                        {field.value && (
                          <Button 
                            type="button" 
                            onClick={(e) => {
                              console.log('🔘 Button clicked!');
                              console.log('   - Event:', e);
                              console.log('   - Field value:', field.value);
                              console.log('   - Watched code:', watchedTrackingCode);
                              console.log('   - Is verifying:', isVerifying);
                              console.log('   - Button disabled:', !watchedTrackingCode || isVerifying);
                              handleVerifyClick();
                            }}
                            disabled={!watchedTrackingCode || isVerifying}
                            className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
                          >
                            {isVerifying ? (
                              <>
                                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Verifying Book Ownership...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Verify Book Ownership
                              </>
                            )}
                          </Button>
                        )}

                        {/* Professional Loading State */}
                        {isVerifying && (
                          <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                            <span className="text-blue-800 font-medium">Verifying book ownership...</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selected Book Information - only show after verification */}
              {selectedBorrowing && (
                <div className="mt-4 p-3 border rounded-md bg-green-50 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      {isFoundLostBook ? 'Found Lost Book' : 'Valid Return'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Book:</p>
                      <p className="font-medium">
                        {selectedBorrowing.books?.title}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Student:</p>
                      <p>
                        {selectedBorrowing?.students?.first_name && selectedBorrowing?.students?.last_name 
                          ? `${selectedBorrowing.students.first_name} ${selectedBorrowing.students.last_name}`
                          : 'Student information not available'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Issue Date:</p>
                      <p>
                        {safeFormatDate(selectedBorrowing.borrowed_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Due Date:</p>
                      <p>
                        {safeFormatDate(selectedBorrowing.due_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Days Overdue:</p>
                      <p className={calculateDaysOverdue(selectedBorrowing.due_date) > 0 ? 'text-red-600' : 'text-green-600'}>
                        {calculateDaysOverdue(selectedBorrowing.due_date)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status:</p>
                      <p className="font-medium">
                        {selectedBorrowing.status}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-green-200 flex justify-end">
                    <Button 
                      type="button" 
                      onClick={() => setActiveTab("return" as any)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      Continue to Return Details →
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="return" className="py-4 px-1 space-y-4">
              {/* Only show return details if a book is selected */}
              {selectedBorrowing ? (
                <>
                  {/* Show group return information banner if it's a group return */}
                  {isGroupReturn && groupInfo && (
                    <Alert className="bg-blue-50 border-blue-200 mb-4">
                      <Users className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium text-blue-800">Group Return Processing</p>
                          <p className="text-sm text-blue-700">
                            You are processing a return for a book borrowed by a group of {groupInfo.studentCount} students.
                            All students in this group will have their borrowing records updated at once.
                          </p>
                          <div className="mt-2 p-2 bg-blue-100 rounded">
                            <p className="text-xs text-blue-800">
                              Group ID: {groupInfo.groupId}
                            </p>
                            <p className="text-xs text-blue-800">
                              Students: {groupBorrowings.length > 0 ? 
                                groupBorrowings.map(b => `${b.students?.first_name} ${b.students?.last_name}`).join(', ') : 
                                'Loading student information...'}
                            </p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Lost Book Checkbox */}
                  <FormField
                    control={form.control as any}
                    name="is_lost"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Book reported as lost
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Check this if the student has reported the book as lost
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Lost Reason (only shown if book is marked as lost) */}
                  {isLost && (
                    <FormField
                      control={form.control as any}
                      name="lost_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason for Loss</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe how the book was lost..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Book Condition - disabled if book is lost */}
                  <FormField
                    control={form.control as any}
                    name="condition_at_return"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Book Condition</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={isLost}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            {isLost && <SelectItem value="lost">Lost</SelectItem>}
                          </SelectContent>
                        </Select>
                        {field.value && (
                          <div className="text-xs text-gray-600 mt-1">
                            {getConditionDescription(field.value)}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Fine Calculation Display */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-800 mb-2">Automatic Fine Calculation:</p>
                    <div className="text-sm text-blue-700 space-y-1">
                      {isTheft && theftDetails ? (
                        <>
                          <div className="p-2 bg-red-50 border border-red-200 rounded mb-2">
                            <p className="font-semibold text-red-700">⚠️ Theft Case Fine:</p>
                            <p className="text-red-600">This book belongs to {theftDetails?.victimBorrowing?.students?.first_name} {theftDetails?.victimBorrowing?.students?.last_name}</p>
                            <p>Fine Amount: KSh {theftFineAmount}</p>
                            <p className="text-xs mt-1 text-red-800">
                              This fine will be issued to the current student for returning a book that belongs to another student.
                              A theft report will be created.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {calculateDaysOverdue(selectedBorrowing.due_date) > 0 && (
                            <p>• Overdue: {calculateDaysOverdue(selectedBorrowing.due_date)} days × KSh {overdueFine} = KSh {calculateDaysOverdue(selectedBorrowing.due_date) * overdueFine}</p>
                          )}
                          <p>• Condition fine: KSh {calculatedFine - (calculateDaysOverdue(selectedBorrowing.due_date) * overdueFine)}</p>
                        </>
                      )}
                      <p className="font-medium border-t border-blue-300 pt-1 mt-2">
                        Total calculated: KSh {isTheft ? theftFineAmount : calculatedFine}
                      </p>
                    </div>
                  </div>

                  {/* Manual Fine Override */}
                  <FormField
                    control={form.control as any}
                    name="fine_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fine Amount Override (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualFineOverride || ''}
                            onChange={(e) => setManualFineOverride(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder={`Auto: KSh ${calculatedFine}`}
                          />
                        </FormControl>
                        <div className="text-xs text-gray-600">
                          Leave empty to use automatic calculation
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Return Notes */}
                  <FormField
                    control={form.control as any}
                    name="return_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes about the condition or return process..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Lost Book Warning */}
                  {isLost && (
                    <Alert variant="default" className="bg-amber-50 border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-amber-800">
                        Marking a book as lost will update inventory records and may incur replacement fees for the student.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                  <AlertCircle className="h-16 w-16 mb-6 text-gray-400" />
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">No Book Selected</h3>
                  <p className="text-gray-600 max-w-md mb-6">
                    Please first select and verify a book in the <strong>Book Identification</strong> tab before proceeding with return details.
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab("identification" as any)}
                    className="flex items-center"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Go to Book Identification
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end space-x-3 mt-6 px-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            
            {/* Report Theft Button - Only show when theft is detected */}
            {isTheft && theftDetails && (
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={bookReturn.isPending}
                className="min-w-[160px] bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {bookReturn.isPending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    {theftDetails.unauthorizedBook ? 'Apply Unauthorized Book Fine' : 'Report Theft & Clear Victim'}
                  </>
                )}
              </Button>
            )}
            
            {/* Process Group Return Button - Only show for group borrowings */}
            {isGroupReturn && groupInfo && (
              <Button 
                type="submit"
                disabled={!selectedBorrowing || bookReturn.isPending}
                className="min-w-[160px] bg-blue-600 hover:bg-blue-700 text-white"
              >
                {bookReturn.isPending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-1.5" />
                    Process Group Return
                  </>
                )}
              </Button>
            )}
            
            {/* Normal Return Button - Only show for non-group borrowings */}
            {!isTheft && !isGroupReturn && (
              <Button 
                type="submit"
                disabled={!selectedBorrowing || bookReturn.isPending}
                className="min-w-[160px] bg-green-600 hover:bg-green-700 text-white"
              >
                {bookReturn.isPending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Complete Return
                  </>
                )}
              </Button>
            )}
          </div>
          
          {!selectedBorrowing && (
            <p className="text-center text-amber-600 text-sm mt-2 bg-amber-50 p-2 rounded-md">
              <AlertTriangle className="inline-block h-4 w-4 mr-1" />
              Please verify a book in the Book Identification tab before submitting
            </p>
          )}
        </form>
      </Form>
    </div>
  );
};
