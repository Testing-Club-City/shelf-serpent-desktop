import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Search, CheckCircle, AlertCircle, BookOpen,
  User, Calendar, ScrollText, AlertTriangle, BookX, Shield, Users, X, Plus, Check
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, differenceInDays } from 'date-fns';
import { useBorrowingsArray, useBookReturn } from '@/hooks/useBorrowings';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  initialBorrowing?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

type Borrowing = Tables<'borrowings'> & {
  students?: Tables<'students'>;
  books?: Tables<'books'>;
  book_copies?: Tables<'book_copies'>;
  book?: {
    title: string;
    author: string;
    legacy_book_id?: number;
  };
  borrower?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number?: string;
    type?: string;
  };
};

interface ReturnedBook {
  id: string;
  borrowing: Borrowing;
  returnData: {
    condition_at_return: string;
    return_notes?: string;
    fine_amount: number;
    is_lost: boolean;
    lost_reason?: string;
    is_theft?: boolean;
    theft_details?: any;
  };
  timestamp: Date;
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

export const MultiBookReturnForm = ({ initialBorrowing, onSubmit, onCancel }: BookReturnFormProps) => {
  // Hooks
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  const detectTheft = useDetectTheft();
  const handleFoundLostBook = useHandleFoundLostBook();
  const { updatePageState } = useDocumentMetaContext();

  // State for multi-book returns
  const [returnedBooks, setReturnedBooks] = useState<ReturnedBook[]>([]);
  const [currentStudent, setCurrentStudent] = useState<any>(
    initialBorrowing?.borrower || initialBorrowing?.students || null
  );
  
  // State declarations - Don't use initialBorrowing for multi-book return
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(null);
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form
  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema) as any,
    defaultValues: {
      returned_tracking_code: '',
      condition_at_return: 'good',
      return_notes: '',
      fine_amount: 0,
      is_lost: false,
      lost_reason: '',
    },
  });

  const watchedTrackingCode = form.watch('returned_tracking_code');
  const isLost = form.watch('is_lost');

  // Set current student from first borrowing
  useEffect(() => {
    if (selectedBorrowing && !currentStudent) {
      // Try borrower first (from API response), fallback to students
      setCurrentStudent(selectedBorrowing.borrower || selectedBorrowing.students);
    }
  }, [selectedBorrowing, currentStudent]);

  // Load fine settings
  useEffect(() => {
    const loadFineSettings = async () => {
      try {
        const fairAmount = await getFineAmountBySetting('fair');
        const poorAmount = await getFineAmountBySetting('poor');
        const damagedAmount = await getFineAmountBySetting('damaged');
        const lostAmount = await getFineAmountBySetting('lost');
        const overdueAmount = await getFineAmountBySetting('overdue_per_day');
        const theftAmount = await getFineAmountBySetting('theft');

        setFairFine(fairAmount);
        setPoorFine(poorAmount);
        setDamagedFine(damagedAmount);
        setLostFine(lostAmount);
        setOverdueFine(overdueAmount);
        setTheftFineAmount(theftAmount);
      } catch (error) {
        console.error('Error loading fine settings:', error);
      }
    };

    loadFineSettings();
  }, []);

  // Calculate fine when condition or borrowing changes
  useEffect(() => {
    if (selectedBorrowing) {
      const condition = form.watch('condition_at_return');
      const fine = calculateFineAmount(condition, selectedBorrowing);
      setCalculatedFine(fine);
      
      if (manualFineOverride === null) {
        form.setValue('fine_amount', fine);
      }
    }
  }, [form.watch('condition_at_return'), selectedBorrowing, isLost, isTheft, theftFineAmount, manualFineOverride]);

  // Verify legacy book ID
  const verifyLegacyBookId = useCallback(async (legacyId: string) => {
    if (!legacyId || legacyId === lastVerifiedCode) return;

    setIsVerifying(true);
    setIsTheft(false);
    setTheftDetails(null);
    setIsFoundLostBook(false);

    try {
      const result: any = await invoke('find_borrowing_by_legacy_book_id', {
        legacyBookId: legacyId.trim()
      });

      if (result?.found && result?.latest_borrowing) {
        const borrowing = result.latest_borrowing;
        
        // Check if this is an active borrowing
        if (borrowing.status !== 'active') {
          toast({
            title: "Book Not Active",
            description: "This book is not currently borrowed or has already been returned.",
            variant: "destructive",
          });
          setIsVerifying(false);
          return;
        }
        
        // Check if this is the same student (flexible matching)
        if (currentStudent && borrowing.borrower) {
          const isSameStudent = 
            borrowing.borrower.id === currentStudent.id ||
            borrowing.borrower.admission_number === currentStudent.admission_number ||
            (borrowing.borrower.first_name === currentStudent.first_name && 
             borrowing.borrower.last_name === currentStudent.last_name);
          
          if (!isSameStudent) {
            // THEFT DETECTED: Student is trying to return a book borrowed by another student
            setIsTheft(true);
            setTheftDetails({
              victimBorrowing: {
                id: borrowing.id,
                student_id: borrowing.borrower.id,
                students: borrowing.borrower,
                books: { title: borrowing.book?.title || result.book?.title, author: borrowing.book?.author || result.book?.author }
              },
              thiefStudentId: currentStudent.id,
              bookCode: legacyId
            });
            // Don't set theftFineAmount here - it's already loaded from database
            setSelectedBorrowing(borrowing);
            setLastVerifiedCode(legacyId);
            
            toast({
              title: "⚠️ THEFT DETECTED",
              description: `This book belongs to ${borrowing.borrower?.first_name} ${borrowing.borrower?.last_name}, not ${currentStudent.first_name} ${currentStudent.last_name}. Theft fine (KES ${theftFineAmount}) will be applied.`,
              variant: "destructive",
            });
            setIsVerifying(false);
            return;
          }
        }

        setSelectedBorrowing(borrowing);
        setLastVerifiedCode(legacyId);
        
        // Set current student from the borrowing if not already set
        if (!currentStudent && borrowing.borrower) {
          setCurrentStudent(borrowing.borrower);
        }
        
        // Check for group borrowing
        const groupBorrowingInfo = getGroupInfo(borrowing);
        if (groupBorrowingInfo) {
          setIsGroupReturn(true);
          setGroupInfo(groupBorrowingInfo);
          
          if (groupBorrowingInfo.groupId) {
            const groupBorrowingsResult = await invoke('get_group_borrowings', {
              groupId: groupBorrowingInfo.groupId
            });
            setGroupBorrowings((groupBorrowingsResult as any)?.borrowings || []);
          }
        } else {
          setIsGroupReturn(false);
          setGroupInfo(null);
          setGroupBorrowings([]);
        }

        toast({
          title: "Book Verified",
          description: `Book found: ${borrowing.book?.title || result.book?.title}`,
        });
      } else {
        toast({
          title: "Book Not Found",
          description: "No active borrowing found with this legacy book ID",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Could not verify the legacy book ID",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  }, [lastVerifiedCode, currentStudent, toast]);

  // Calculate fine amount
  const calculateFineAmount = (condition: string, borrowing: Borrowing) => {
    if (isTheft) return theftFineAmount;
    if (isLost) return lostFine;

    let fine = 0;
    
    // Condition fine
    switch (condition) {
      case 'fair':
        fine += fairFine;
        break;
      case 'poor':
        fine += poorFine;
        break;
      case 'damaged':
        fine += damagedFine;
        break;
      case 'lost':
        fine += lostFine;
        break;
    }

    // Overdue fine
    if (borrowing.due_date) {
      const daysOverdue = calculateDaysOverdue(borrowing.due_date);
      if (daysOverdue > 0) {
        fine += daysOverdue * overdueFine;
      }
    }

    return fine;
  };

  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const days = differenceInDays(today, due);
    return Math.max(0, days);
  };

  const getConditionDescription = (condition: string) => {
    const descriptions: Record<string, string> = {
      excellent: 'Perfect condition, no wear (No Fine)',
      good: 'Minor wear, fully functional (No Fine)',
      fair: `Minor damage (Fine: KSh ${fairFine})`,
      poor: `Significant damage (Fine: KSh ${poorFine})`,
      damaged: `Severe damage (Fine: KSh ${damagedFine})`,
      lost: `Book is lost (Fine: KSh ${lostFine})`,
    };
    return descriptions[condition] || '';
  };

  const safeFormatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'PPP');
    } catch {
      return 'Invalid Date';
    }
  };

  // Add current book to returned list
  const addToReturnedBooks = () => {
    if (!selectedBorrowing) return;

    const returnData = {
      condition_at_return: form.getValues('condition_at_return'),
      return_notes: form.getValues('return_notes'),
      fine_amount: manualFineOverride ?? calculatedFine,
      is_lost: form.getValues('is_lost'),
      lost_reason: form.getValues('lost_reason'),
      is_theft: isTheft,
      theft_details: isTheft ? theftDetails : undefined,
    };

    const returnedBook: ReturnedBook = {
      id: selectedBorrowing.id,
      borrowing: selectedBorrowing,
      returnData,
      timestamp: new Date(),
    };

    setReturnedBooks([...returnedBooks, returnedBook]);
    
    // Reset form for next book
    form.reset({
      returned_tracking_code: '',
      condition_at_return: '',
      return_notes: '',
      fine_amount: 0,
      is_lost: false,
      lost_reason: '',
    });
    
    setSelectedBorrowing(null);
    setLastVerifiedCode('');
    setManualFineOverride(null);
    setCalculatedFine(0);
    setIsTheft(false);
    setTheftDetails(null);
    setActiveTab('identification');
    
    toast({
      title: "Book Added to Return Queue",
      description: `${returnedBooks.length + 1} book(s) ready to return`,
    });
  };

  // Remove book from returned list
  const removeReturnedBook = (id: string) => {
    setReturnedBooks(returnedBooks.filter(book => book.id !== id));
    toast({
      title: "Book Removed",
      description: "Book removed from return queue",
    });
  };

  // Submit all returns
  const handleSubmitAll = async () => {
    if (returnedBooks.length === 0) {
      toast({
        title: "No Books to Return",
        description: "Please add at least one book to return",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  // Confirm and process all returns
  const confirmAndProcessReturns = async () => {
    setShowConfirmDialog(false);

    try {
      // Process all returns
      for (const returnedBook of returnedBooks) {
        const returnPayload = {
          id: returnedBook.borrowing.id,
          returned_date: new Date().toISOString(),
          ...returnedBook.returnData,
        };

        await bookReturn.mutateAsync(returnPayload);
      }

      toast({
        title: "All Returns Processed Successfully",
        description: `Successfully returned ${returnedBooks.length} book${returnedBooks.length !== 1 ? 's' : ''} for ${currentStudent?.first_name} ${currentStudent?.last_name}`,
      });

      onSubmit({ returnedBooks });
      
      // Reset everything
      setReturnedBooks([]);
      setCurrentStudent(null);
      form.reset();
    } catch (error) {
      console.error('Error processing returns:', error);
      toast({
        title: "Return Failed",
        description: "Failed to process one or more returns. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selectedBorrowing) return;

    // Add to queue instead of submitting immediately
    addToReturnedBooks();
  });

  return (
    <div className="space-y-6">
      {/* Current Student Info */}
      {currentStudent && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentStudent.first_name} {currentStudent.last_name}
                </h3>
                <p className="text-sm text-gray-600">
                  Admission: {currentStudent.admission_number} | Class: {currentStudent.class_grade}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Returned Books Queue */}
      {returnedBooks.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">
                  Books Ready to Return ({returnedBooks.length})
                </h3>
              </div>
              <Button
                onClick={handleSubmitAll}
                disabled={bookReturn.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {bookReturn.isPending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete All Returns
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {returnedBooks.map((book) => (
                  <div
                    key={book.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      book.returnData.is_theft 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-white border-green-200'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{book.borrowing.book?.title}</p>
                      <div className="flex gap-4 text-sm text-gray-600 mt-1">
                        {book.returnData.is_theft ? (
                          <>
                            <Badge variant="destructive" className="bg-red-600">
                              ⚠️ THEFT
                            </Badge>
                            <span className="font-medium text-red-700">Fine: KSh {book.returnData.fine_amount}</span>
                          </>
                        ) : (
                          <>
                            <span>Condition: {book.returnData.condition_at_return}</span>
                            <span>Fine: KSh {book.returnData.fine_amount}</span>
                            {book.returnData.is_lost && (
                              <Badge variant="destructive">Lost</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReturnedBook(book.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Return Form */}
      <div className="flex items-center gap-2 px-4">
        <div className="bg-amber-100 p-1.5 rounded-full">
          <BookOpen className="h-5 w-5 text-amber-700" />
        </div>
        <h2 className="text-lg font-semibold">
          {returnedBooks.length > 0 ? 'Return Another Book' : 'Book Return Process with Verification'}
        </h2>
      </div>
      
      <div className="text-sm text-gray-600 px-4">
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
              {/* Book ID Input */}
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

              <FormField
                control={form.control as any}
                name="returned_tracking_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Book Legacy ID</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter legacy book ID (e.g., 468, 466, 788...)"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        onClick={() => verifyLegacyBookId(field.value)}
                        disabled={isVerifying || !field.value}
                      >
                        {isVerifying ? 'Verifying...' : 'Verify'}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Verified Book Display - Only show if book was actually verified */}
              {selectedBorrowing && lastVerifiedCode && (
                <div className="mt-6 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-green-900 mb-2">Book Verified ✓</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-green-700 font-medium">Title: {selectedBorrowing.book?.title}</p>
                          <p className="text-green-700">Author: {selectedBorrowing.book?.author}</p>
                          <p className="text-green-700">Legacy ID: {lastVerifiedCode}</p>
                        </div>
                        <div>
                          <p className="text-green-700">Student: {selectedBorrowing.borrower?.first_name} {selectedBorrowing.borrower?.last_name}</p>
                          <p className="text-green-700">Borrowed: {safeFormatDate(selectedBorrowing.borrowed_date)}</p>
                          <p className="text-green-700">Due: {safeFormatDate(selectedBorrowing.due_date)}</p>
                          {calculateDaysOverdue(selectedBorrowing.due_date || '') > 0 && (
                            <Badge variant="destructive" className="mt-1">
                              {calculateDaysOverdue(selectedBorrowing.due_date || '')} days overdue
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Quick Return Buttons */}
                      <div className="mt-4 space-y-2">
                        {/* Show theft warning if theft detected */}
                        {isTheft && (
                          <div className="p-3 bg-red-50 border-2 border-red-500 rounded-lg">
                            <p className="text-sm font-semibold text-red-700 mb-1">⚠️ THEFT DETECTED</p>
                            <p className="text-xs text-red-600">
                              This book belongs to {theftDetails?.victimBorrowing?.students?.first_name} {theftDetails?.victimBorrowing?.students?.last_name}.
                              A theft fine of KES {theftFineAmount} will be applied. Use "More Options" to proceed with theft case.
                            </p>
                          </div>
                        )}
                        
                        {/* Quick Return only available for non-theft cases */}
                        {!isTheft && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                // Set condition to good and add to queue immediately
                                form.setValue('condition_at_return', 'good');
                                addToReturnedBooks();
                              }}
                              disabled={bookReturn.isPending}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {returnedBooks.length > 0 ? 'Return Another (Good Condition)' : 'Quick Return (Good Condition)'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setActiveTab("return")}
                              variant="outline"
                              className="border-green-600 text-green-700 hover:bg-green-50"
                              size="sm"
                            >
                              More Options →
                            </Button>
                          </div>
                        )}
                        
                        {/* For theft cases, only show More Options button */}
                        {isTheft && (
                          <Button
                            type="button"
                            onClick={() => setActiveTab("return")}
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            size="sm"
                          >
                            Proceed with Theft Case →
                          </Button>
                        )}
                        
                        {!isTheft && (
                          <p className="text-xs text-green-700 italic">
                            Quick Return uses "Good" condition (no fine). Click "More Options" to set different condition or add notes.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ready to Scan Book message - show when no book verified yet */}
              {!selectedBorrowing && !isVerifying && (
                <div className="mt-6 flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Ready to Scan Book</h4>
                  <p className="text-sm text-gray-600 text-center max-w-md">
                    Enter the legacy book ID above and click <strong>Verify</strong> to identify the borrowing<br/>
                    <span className="text-xs text-gray-500 mt-1 block">Legacy IDs are typically found on book covers or spines</span>
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="return" className="py-4 px-1 space-y-4">
              {selectedBorrowing ? (
                <>
                  {/* Theft Warning */}
                  {isTheft && (
                    <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-800 text-sm mb-1">⚠️ THEFT CASE DETECTED</p>
                          <p className="text-xs text-red-700 mb-2">
                            This book was borrowed by <strong>{theftDetails?.victimBorrowing?.students?.first_name} {theftDetails?.victimBorrowing?.students?.last_name}</strong>, 
                            but is being returned by <strong>{currentStudent?.first_name} {currentStudent?.last_name}</strong>.
                          </p>
                          <p className="text-xs text-red-700 font-medium">
                            Theft fine: KES {theftFineAmount}
                          </p>
                        </div>
                      </div>
                    </div>
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
                            disabled={isTheft}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Book reported as lost
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            {isTheft 
                              ? "Not applicable for theft cases" 
                              : "Check this if the student has reported the book as lost"
                            }
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Lost Reason */}
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

                  {/* Book Condition */}
                  <FormField
                    control={form.control as any}
                    name="condition_at_return"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Book Condition</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={isLost || isTheft}
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
                        {field.value && !isTheft && (
                          <div className="text-xs text-gray-600 mt-1">
                            {getConditionDescription(field.value)}
                          </div>
                        )}
                        {isTheft && (
                          <div className="text-xs text-red-600 mt-1 font-medium">
                            Book condition is not relevant for theft cases - fixed theft fine applies
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Fine Calculation Display */}
                  <div className={`p-4 border rounded-md ${isTheft ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-sm font-medium mb-2 ${isTheft ? 'text-red-800' : 'text-blue-800'}`}>
                      {isTheft ? 'Theft Fine Calculation:' : 'Automatic Fine Calculation:'}
                    </p>
                    <div className={`text-sm space-y-1 ${isTheft ? 'text-red-700' : 'text-blue-700'}`}>
                      {isTheft ? (
                        <>
                          <p className="font-semibold">• Theft penalty: KSh {theftFineAmount}</p>
                          <p className="text-xs italic">Student is returning a book borrowed by another student</p>
                        </>
                      ) : (
                        <>
                          {calculateDaysOverdue(selectedBorrowing.due_date || '') > 0 && (
                            <p>• Overdue: {calculateDaysOverdue(selectedBorrowing.due_date || '')} days × KSh {overdueFine} = KSh {calculateDaysOverdue(selectedBorrowing.due_date || '') * overdueFine}</p>
                          )}
                          <p>• Condition fine: KSh {calculatedFine - (calculateDaysOverdue(selectedBorrowing.due_date || '') * overdueFine)}</p>
                        </>
                      )}
                      <p className={`font-medium pt-1 mt-2 ${isTheft ? 'border-t border-red-400' : 'border-t border-blue-300'}`}>
                        Total calculated: KSh {calculatedFine}
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
                    onClick={() => setActiveTab("identification")}
                    className="flex items-center"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Go to Book Identification
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 px-2 space-y-3">
            {/* Primary Action Buttons - Only show on return tab OR when no book is selected */}
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              
              {/* Only show Add/Return button when on Return Details tab with a selected book */}
              {(activeTab === 'return' && selectedBorrowing) && (
                <Button 
                  type="submit"
                  disabled={!selectedBorrowing || bookReturn.isPending || (!isTheft && !form.watch('condition_at_return'))}
                  className={`min-w-[200px] ${isTheft ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                >
                  {bookReturn.isPending ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </>
                  ) : returnedBooks.length > 0 ? (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {isTheft ? 'Add Theft Case to Queue' : 'Return Another Book'}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {isTheft ? 'Add Theft Case to Queue' : 'Add to Queue'}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Complete All Returns Button - Only show when there are books in queue */}
            {returnedBooks.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <Button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={bookReturn.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base"
                >
                  {bookReturn.isPending ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing All Returns...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Done - Complete All Returns ({returnedBooks.length} {returnedBooks.length === 1 ? 'Book' : 'Books'})
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-gray-500 mt-2">
                  This will process all {returnedBooks.length} book return{returnedBooks.length !== 1 ? 's' : ''} for {currentStudent?.first_name} {currentStudent?.last_name}
                </p>
              </div>
            )}
          </div>
          
          {!selectedBorrowing && activeTab === 'return' && (
            <p className="text-center text-amber-600 text-sm mt-2 bg-amber-50 p-2 rounded-md">
              <AlertTriangle className="inline-block h-4 w-4 mr-1" />
              Please verify a book in the Book Identification tab before adding to queue
            </p>
          )}

          {selectedBorrowing && activeTab === 'return' && !form.watch('condition_at_return') && !isTheft && (
            <p className="text-center text-blue-600 text-sm mt-2 bg-blue-50 p-2 rounded-md border border-blue-200">
              <AlertCircle className="inline-block h-4 w-4 mr-1" />
              Please select the book condition above to enable the Add to Queue button
            </p>
          )}
          
          {selectedBorrowing && activeTab === 'return' && isTheft && (
            <p className="text-center text-red-600 text-sm mt-2 bg-red-50 p-2 rounded-md border border-red-300">
              <AlertTriangle className="inline-block h-4 w-4 mr-1" />
              Theft case ready to add to queue - KES {theftFineAmount} fine will be applied
            </p>
          )}
        </form>
      </Form>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Confirm Book Returns
            </DialogTitle>
            <DialogDescription>
              Please review the books you're about to return for {currentStudent?.first_name} {currentStudent?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Student Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Student Information</span>
              </div>
              <p className="text-sm text-blue-800">
                {currentStudent?.first_name} {currentStudent?.last_name} - Admission: {currentStudent?.admission_number}
              </p>
            </div>

            {/* Books Summary */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Books to Return ({returnedBooks.length})</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {returnedBooks.map((book, index) => (
                  <div 
                    key={book.id} 
                    className={`border rounded p-3 ${
                      book.returnData.is_theft 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {index + 1}. {book.borrowing.book?.title || book.borrowing.books?.title}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-600">
                          {book.returnData.is_theft ? (
                            <>
                              <Badge variant="destructive" className="text-xs bg-red-600">
                                ⚠️ THEFT CASE
                              </Badge>
                              <span className="font-medium text-red-700">Fine: KSh {book.returnData.fine_amount}</span>
                            </>
                          ) : (
                            <>
                              <span>Condition: <span className="font-medium">{book.returnData.condition_at_return}</span></span>
                              <span>Fine: <span className="font-medium">KSh {book.returnData.fine_amount}</span></span>
                            </>
                          )}
                        </div>
                        {book.returnData.is_lost && !book.returnData.is_theft && (
                          <Badge variant="destructive" className="mt-1 text-xs">Lost</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Fine */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-green-900">Total Fines:</span>
                <span className="text-lg font-bold text-green-900">
                  KSh {returnedBooks.reduce((sum, book) => sum + book.returnData.fine_amount, 0)}
                </span>
              </div>
            </div>

            {/* Warning */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Once confirmed, all {returnedBooks.length} book{returnedBooks.length !== 1 ? 's' : ''} will be marked as returned. This action cannot be undone.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={bookReturn.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmAndProcessReturns}
              disabled={bookReturn.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {bookReturn.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Complete Returns
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
