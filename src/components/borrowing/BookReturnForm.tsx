import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  // Hooks
  const { data: borrowings } = useBorrowingsArray();
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  const detectTheft = useDetectTheft();
  const handleFoundLostBook = useHandleFoundLostBook();
  const { updatePageState } = useDocumentMetaContext();

  // Filter active borrowings with tracking codes
  const activeBorrowings = borrowings?.filter(borrowing => 
    borrowing.status === 'active' && borrowing.tracking_code
  ) || [];

  // State declarations
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(initialBorrowing || null);
  const [isGroupReturn, setIsGroupReturn] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ studentCount: number; groupId: string | null } | null>(null);
  const [groupBorrowings, setGroupBorrowings] = useState<Borrowing[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerifiedCode, setLastVerifiedCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'return' | 'lost' | 'theft'>('return');
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
  const [theftFineAmount, setTheftFineAmount] = useState(0);

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

  // Filter active borrowings based on search term
  const filteredBorrowings = activeBorrowings.filter((b) =>
    b.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.books?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.students?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Helper functions moved inside component to fix scoping
  const calculateDaysOverdue = (dueDate: Date | string, returnDate: Date | string = new Date()) => {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const ret = typeof returnDate === 'string' ? new Date(returnDate) : returnDate;
    const diffTime = Math.max(0, ret.getTime() - due.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  // Memoize the verifyTrackingCode function with proper dependencies
  const verifyTrackingCode = useCallback((trackingCode: string) => {
    if (!trackingCode || !trackingCode.trim()) {
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);
    setLastVerifiedCode(trackingCode);

    // First check if this is a group return
    const groupBorrowing = groupBorrowings.find(b => b.tracking_code === trackingCode);
    if (groupBorrowing) {
      console.log('Found group borrowing:', groupBorrowing);
      setSelectedBorrowing(groupBorrowing as any);
      setIsGroupReturn(true);
      setGroupInfo(getGroupInfo(groupBorrowing));

      // Find all borrowings in this group
      const info = getGroupInfo(groupBorrowing);
      if (info && info.groupId) {
        const groupBorrs = activeBorrowings.filter(b => {
          const bInfo = getGroupInfo(b);
          return bInfo && bInfo.groupId === info.groupId;
        });
        setGroupBorrowings(groupBorrs as any);
      }

      updatePageState('success', `Group Book: ${groupBorrowing.books?.title}`);
      setIsVerifying(false);
      return;
    }

    // Then check if it's a regular borrowing
    const borrowing = activeBorrowings.find(b => b.tracking_code === trackingCode);
    if (borrowing) {
      console.log('Found regular borrowing:', borrowing);
      setSelectedBorrowing(borrowing as any);
      setIsGroupReturn(false);
      updatePageState('success', `Valid Book: ${borrowing.books?.title}`);
      setIsVerifying(false);
      return;
    }

    // If not found, clear selection and show error
    setSelectedBorrowing(null);
    setIsGroupReturn(false);
    setGroupInfo(null);
    setGroupBorrowings([]);
    updatePageState('error', 'Unknown Book Code');
    setIsVerifying(false);
  }, [activeBorrowings, groupBorrowings, updatePageState]);

  // Watch for changes in tracking code
  useEffect(() => {
    // Only verify if the tracking code has changed
    if (watchedTrackingCode && watchedTrackingCode !== lastVerifiedCode) {
      verifyTrackingCode(watchedTrackingCode);
    }
  }, [watchedTrackingCode, verifyTrackingCode, lastVerifiedCode]);

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

  const handleTrackingCodeSelect = (trackingCode: string) => {
    form.setValue('returned_tracking_code', trackingCode);
    setSearchTerm('');
    setShowCustomInput(false);
    // Automatically verify when a book is selected from the dropdown
    verifyTrackingCode(trackingCode);
  };

  const handleVerifyClick = () => {
    const trackingCode = form.getValues('returned_tracking_code');
    if (trackingCode && trackingCode.trim()) {
      verifyTrackingCode(trackingCode);
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
                        thief_student_id: isTheft ? initialBorrowing?.student_id : null,
                        expected_tracking_code: selectedBorrowing?.tracking_code || (isTheft && theftDetails?.victimBorrowing?.tracking_code),
                        // For theft cases
                        ...(isTheft && theftDetails && {
                          theft_reason: 'Book returned by person other than borrower',
                          victim_student_id: theftDetails?.victimBorrowing?.student_id,
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
        fine_amount: manualFineOverride !== null ? manualFineOverride : calculatedFine
      };
      
      console.log('Submitting return data:', returnData);
      
      // Call the onSubmit callback
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
            
            <TabsContent value="identification" className="py-4 px-1">
              {/* Book Verification Alert */}
              {watchedTrackingCode && (selectedBorrowing || isTheft) && (
                <div className="mb-4">
                  {isTheft && theftDetails ? (
                    <Alert variant="destructive">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">⚠️ Book Belongs to Another Student</p>
                          <div className="text-sm space-y-1">
                            <p><span className="font-medium">Book Code:</span> <code>{watchedTrackingCode}</code></p>
                            <p><span className="font-medium">Issued To:</span> {theftDetails?.victimBorrowing?.students?.first_name} {theftDetails?.victimBorrowing?.students?.last_name}</p>
                            <p><span className="font-medium">Admission:</span> {theftDetails.victimBorrowing.students?.admission_number}</p>
                            <p><span className="font-medium">Book Title:</span> {theftDetails?.victimBorrowing?.books?.title}</p>
                            <p><span className="font-medium">Issue Date:</span> {safeFormatDate(theftDetails?.victimBorrowing?.borrowed_date)}</p>
                          </div>
                          <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                            This book is currently issued to another student. Please verify the book code.
                          </p>
                          {initialBorrowing?.student_id && (
                            <p className="text-xs mt-2 bg-red-700 text-white p-2 rounded font-semibold">
                              WARNING: A fine will be issued to the current student for theft/misappropriation.
                            </p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : isGroupReturn && groupInfo ? (
                    <Alert className="bg-blue-50 border-blue-200">
                      <Users className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium text-blue-800">✅ Group Borrowing Detected</p>
                          <div className="text-sm space-y-1">
                            <p><span className="font-medium">Book Code:</span> <code>{selectedBorrowing.tracking_code}</code></p>
                            <p><span className="font-medium">Book Title:</span> {selectedBorrowing.books?.title}</p>
                            <p><span className="font-medium">Group Size:</span> {groupInfo.studentCount} students</p>
                            <p><span className="font-medium">Students in Group:</span> {groupBorrowings.length > 0 ? 
                              groupBorrowings.map(b => `${b.students?.first_name} ${b.students?.last_name}`).join(', ') : 
                              'Loading student information...'}</p>
                          </div>
                          <div className="bg-blue-100 p-2 rounded mt-2">
                            <p className="text-blue-800 font-medium">This is a group borrowing. All {groupInfo.studentCount} students will be processed at once.</p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : selectedBorrowing ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">✅ Book Verified Successfully</p>
                          {isFoundLostBook && (
                            <p className="text-green-600 font-medium">📚 This was a lost book that has been found!</p>
                          )}
                          <div className="text-sm space-y-1">
                            <p><span className="font-medium">Book Code:</span> <code>{selectedBorrowing.tracking_code}</code></p>
                            <p><span className="font-medium">Issued To:</span> {selectedBorrowing.students?.first_name} {selectedBorrowing.students?.last_name}</p>
                            <p><span className="font-medium">Admission:</span> {selectedBorrowing.students?.admission_number}</p>
                            <p><span className="font-medium">Issue Date:</span> {safeFormatDate(selectedBorrowing.borrowed_date)}</p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}

              {/* Show verification prompt when code is manually entered but not verified */}
              {watchedTrackingCode && !selectedBorrowing && !isTheft && !isVerifying && showCustomInput && (
                <Alert variant="default" className="mb-4 bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <div className="space-y-1">
                      <p className="font-medium">Book Code Requires Verification</p>
                      <p className="text-sm">
                        Please click the "Verify Book Ownership" button to confirm this book belongs to the student.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Process steps guidance */}
              {!selectedBorrowing && !isTheft && (
                <div className="mb-6 border rounded-lg p-4 bg-blue-50 border-blue-100">
                  <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                    <Search className="h-4 w-4 mr-2" />
                    Return Process Steps
                  </h3>
                  <ol className="text-sm text-blue-700 space-y-2 pl-6 list-decimal">
                    <li>Find or scan the book's tracking code</li>
                    <li>Click the <strong>Verify Book Ownership</strong> button</li>
                    <li>Once verified, fill return details in the next tab</li>
                    <li>Complete the return process</li>
                  </ol>
                </div>
              )}

              {/* Book Tracking Code */}
              <FormField
                control={form.control as any}
                name="returned_tracking_code"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel className="text-base font-medium">Book Copy Identifier</FormLabel>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Scan or enter book code..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      {searchTerm && (
                        <Card className="p-1 border shadow-sm">
                          <ScrollArea className="max-h-[180px] overflow-y-auto">
                            <div className="space-y-1">
                              {filteredBorrowings.map((borrowing) => {
                                const daysOverdue = calculateDaysOverdue(borrowing.due_date);
                                const copyNumber = borrowing.book_copies?.copy_number || '?';
                                return (
                                  <div
                                    key={borrowing.id}
                                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                                    onClick={() => handleTrackingCodeSelect(borrowing.tracking_code)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Badge className="bg-blue-100 text-blue-800 font-bold">
                                        Copy #{copyNumber}
                                      </Badge>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{borrowing.books?.title}</span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                          ID: {borrowing.tracking_code}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Due: {new Date(borrowing.due_date).toLocaleDateString()}
                                    </div>
                                  </div>
                                );
                              })}
                              {filteredBorrowings.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                  <p>No borrowings found.</p>
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="p-0 h-auto text-xs"
                                    onClick={() => setShowCustomInput(true)}
                                  >
                                    Enter tracking code manually
                                  </Button>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </Card>
                      )}
                      
                      {showCustomInput && (
                        <FormControl>
                          <Input
                            placeholder="Enter book tracking code..."
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setSearchTerm('');
                            }}
                          />
                        </FormControl>
                      )}
                      
                      {!showCustomInput && !searchTerm && !field.value && (
                        <div className="text-center py-4 border border-dashed rounded-lg bg-gray-50">
                          <BookOpen className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-600 mb-1">Scan a book barcode or search by book information</p>
                          <p className="text-xs text-gray-500 mb-3">Book codes can be found printed on the inside cover or barcode</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomInput(true)}
                          >
                            Enter book code manually
                          </Button>
                        </div>
                      )}

                      {/* Verify button - only show for manually entered codes */}
                      {(showCustomInput && field.value) && (
                        <Button 
                          type="button" 
                          onClick={handleVerifyClick} 
                          disabled={!watchedTrackingCode || isVerifying}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isVerifying ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Verify Book Ownership
                            </>
                          )}
                        </Button>
                      )}

                      {/* Show verifying state when auto-verifying */}
                      {isVerifying && !showCustomInput && (
                        <div className="flex items-center justify-center p-2 text-blue-600">
                          <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1.5"></div>
                          <span className="text-sm">Verifying book...</span>
                        </div>
                      )}
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
                        {`${selectedBorrowing.students?.first_name} ${selectedBorrowing.students?.last_name}`}
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
                    Report Theft & Clear Victim
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
